"""
VoiceTyper Python Engine (v3 — Multi-Backend)
==============================================
Supports both LOCAL and API backends:

  ASR (语音识别):
    - local:  Whisper (tiny/base/small)
    - api:    OpenAI Whisper API / 阿里云 Paraformer API

  LLM (文字润色):
    - local:  Ollama (Qwen 3.5, DeepSeek, etc.)
    - api:    OpenAI-compatible API (DeepSeek, Qwen API, GLM, etc.)

Config Example (set via set_config command):
  {
    "asr_backend": "local",        # "local" | "api"
    "asr_local_model": "whisper-base",  # whisper-tiny | whisper-base | whisper-small
    "asr_api_url": "",             # e.g. "https://api.openai.com/v1/audio/transcriptions"
    "asr_api_key": "",
    "asr_api_model": "whisper-1",

    "llm_backend": "local",        # "local" | "api"
    "llm_local_model": "qwen3.5:4b",
    "llm_api_url": "",             # e.g. "https://api.deepseek.com/v1/chat/completions"
    "llm_api_key": "",
    "llm_api_model": "deepseek-chat",
  }
"""

import sys
import os
import json
import threading
import tempfile
import urllib.request
import re

import numpy as np
from scipy.io import wavfile

try:
    import sounddevice as sd
except Exception:
    sd = None

POLISH_SYSTEM_PROMPT = (
    "你是一个中文口语整理助手。你的任务是把语音识别得到的口语文本整理成更工整、可读性更好的书面表达。\n"
    "【绝对规则】：\n"
    "1. 直接且仅输出整理后的文本，绝不输出解释、前后缀、注释。\n"
    "2. 保留原意与关键信息，不得捏造事实，不得新增输入中不存在的信息。\n"
    "3. 必须删除口头禅、思考停顿和无意义重复（如“嗯、那个、就是、然后”）。\n"
    "4. 对于同义重复、自我修正、半句重来，只保留一次最完整、最自然的表达。\n"
    "5. 在不改变原意前提下，可适度重组语序，使句子更自然、更清晰。\n"
    "6. 若输入本身已经清晰，仅做最小必要修改。\n"
    "7. 输入很短时也必须直接输出整理结果。"
)

TRANSLATE_SYSTEM_PROMPT = (
    "你是一个无情的翻译机器。你的唯一任务是将用户输入的文本进行语言转换。\n"
    "【绝对规则】：\n"
    "1. 直接且仅输出翻译后的文本，绝不包含任何问候、解释等废话。\n"
    "2. 当输入主要为中文时，翻译为地道流利的英文；当输入为英文时，翻译为中文。\n"
    "3. 即使输入文本极短，也只输出对应的翻译结果，不许要求提供更多上下文。"
)


class VoiceEngine:
    def __init__(self):
        self._whisper = None
        self.is_recording = False
        self.audio_data = []
        self.sample_rate = 16000
        self.stream = None
        self._pending_audio = None
        self.current_recording_mode = "normal"
        self.llm_available = False
        self.config = {
            # ASR settings
            "asr_backend": "local",          # "local" | "api"
            "asr_local_model": "whisper-base",
            "asr_api_url": "",
            "asr_api_key": "",
            "asr_api_model": "whisper-1",

            # LLM settings
            "llm_backend": "local",          # "local" | "api"
            "llm_local_model": "qwen2.5:3b",
            "llm_api_url": "",               # OpenAI-compatible endpoint
            "llm_api_key": "",
            "llm_api_model": "",

            # General
            "language": "zh",
            "polish_enabled": True,
            "auto_type": True,
        }

    # ===== IPC =====

    def send(self, event: str, **kw):
        msg = {"event": event, **kw}
        sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    # ===== Model Loading =====

    @staticmethod
    def _has_meaningful_text(text: str) -> bool:
        # Treat punctuation-only output as empty/silent to avoid false "polish" results like "。"
        cleaned = re.sub(r'[\s\W_]+', '', text, flags=re.UNICODE)
        return len(cleaned) > 0

    def load_asr(self):
        if self.config["asr_backend"] == "api":
            self._whisper = None
            self.send("status", message="ASR 使用 API 模式，无需加载本地模型")
            return

        try:
            whisper_size = self._resolve_whisper_size(self.config.get("asr_local_model"))
            self.config["asr_local_model"] = f"whisper-{whisper_size}"
            self._load_whisper(whisper_size)
        except Exception as e:
            self.send("error", message=f"ASR 加载失败: {e}，尝试 Whisper 回退...")
            self._load_whisper_fallback()

    @staticmethod
    def _resolve_whisper_size(value) -> str:
        norm = str(value or "").strip().lower()
        mapping = {
            "whisper-tiny": "tiny",
            "tiny": "tiny",
            "whisper-base": "base",
            "base": "base",
            "whisper-small": "small",
            "small": "small",
        }
        # Legacy/invalid values fallback to base.
        return mapping.get(norm, "base")

    def _load_whisper(self, size: str):
        size_hint_mb = {
            "tiny": "39MB",
            "base": "142MB",
            "small": "466MB",
        }.get(size, "未知大小")
        cache_path = os.path.join(os.path.expanduser("~"), ".cache", "whisper", f"{size}.pt")
        if os.path.exists(cache_path):
            self.send("status", message=f"正在加载 Whisper {size} 本地模型...")
        else:
            self.send("status", message=f"首次使用 Whisper {size}，正在下载模型（约 {size_hint_mb}）...")
        import whisper
        self._whisper = whisper.load_model(size)
        self.send("status", message=f"Whisper {size} 就绪")

    def _load_whisper_fallback(self):
        try:
            self._load_whisper("base")
        except Exception as e:
            self._whisper = None
            self.send("error", message=f"无可用 ASR 模型: {e}")

    def check_llm(self):
        if self.config["llm_backend"] == "api":
            if self.config["llm_api_url"] and self.config["llm_api_key"]:
                self.llm_available = True
                self.send("status", message=f"LLM 使用 API: {self.config['llm_api_model']}")
            else:
                self.llm_available = False
                self.send("status", message="LLM API 未配置，润色功能禁用")
                self.config["polish_enabled"] = False
            self.send("capabilities", llm_available=self.llm_available, translate_available=self.llm_available)
            return

        # Local: check Ollama
        try:
            import ollama
            models = ollama.list()
            names = [m.model for m in models.models] if hasattr(models, 'models') else []
            target = self.config["llm_local_model"]
            if any(target in n for n in names):
                self.llm_available = True
                self.send("status", message=f"Ollama 就绪: {target}")
            else:
                self.llm_available = False
                self.send("status", message=f"Ollama 未找到 {target}，请运行 ollama pull {target}")
                self.config["polish_enabled"] = False
        except Exception as e:
            self.llm_available = False
            self.send("status", message=f"Ollama 未运行: {e}")
            self.config["polish_enabled"] = False
        self.send("capabilities", llm_available=self.llm_available, translate_available=self.llm_available)

    # ===== Recording =====

    def start_recording(self):
        if self.is_recording:
            return
        self.is_recording = True
        self.audio_data = []
        
        # We need a frame counter to emit volume events at roughly 20 FPS (every ~50ms)
        # Sample rate is 16000. 16000 / 20 = 800 frames per event.
        # But we get callbacks in chunks, so we just aggregate and emit periodically.
        self._vol_accum = []

        def cb(indata, frames, time_info, status):
            if self.is_recording:
                self.audio_data.append(indata.copy())
                # Real-time Volume Calculation (RMS) for UI
                self._vol_accum.append(indata.copy())
                # Every ~1000 frames (approx 60ms), calculate and emit
                if sum(len(x) for x in self._vol_accum) > 1000:
                    chunk = np.concatenate(self._vol_accum, axis=0).flatten()
                    rms = np.sqrt(np.mean(chunk**2))
                    # Scale RMS (typically 0.0 to 0.1 for voice) to an integer 0-100 logic
                    vol = min(100, int(rms * 1000)) 
                    self.send("audio_level", level=vol)
                    self._vol_accum = []

        self.stream = sd.InputStream(
            samplerate=self.sample_rate, channels=1, dtype="float32", callback=cb
        )
        self.stream.start()
        self.send("recording_started", mode=self.current_recording_mode)

    def stop_recording(self):
        if not self.is_recording:
            return
        self.is_recording = False

        # Capture and close stream safely FIRST, before any processing
        stream = self.stream
        self.stream = None
        audio_data = self.audio_data
        self.audio_data = []

        if stream:
            try:
                stream.stop()
                stream.close()
            except Exception:
                pass
        del stream  # Ensure C object is released before numpy processing

        self.send("recording_stopped")

        if not audio_data:
            self.send("transcription", text="", is_silent=True)
            return

        try:
            audio = np.concatenate(audio_data, axis=0).flatten()
        except Exception:
            self.send("transcription", text="", is_silent=True)
            return

        if np.max(np.abs(audio)) < 0.01:
            self.send("transcription", text="", is_silent=True)
            return

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            wavfile.write(temp_path, self.sample_rate, (audio * 32767).astype(np.int16))

        try:
            raw = self.transcribe(temp_path, audio)
            self.send("transcription", text=raw)

            if raw.strip():
                if self.config["polish_enabled"]:
                    polished = self.polish(raw)
                    self.send("polished", text=polished)
                    final = polished
                else:
                    final = raw

                if self.config["auto_type"]:
                    self.type_text(final)
                    self.send("typed", text=final)
        except Exception as e:
            self.send("error", message=f"处理失败: {e}")
        finally:
            try:
                os.unlink(temp_path)
            except OSError:
                pass

    # ===== ASR =====

    def transcribe(self, wav_path: str, audio_np: np.ndarray) -> str:
        backend = self.config["asr_backend"]

        if backend == "api":
            return self._asr_api(wav_path)
        else:
            if self._whisper:
                return self._asr_whisper(audio_np)
            return ""

    def _asr_whisper(self, audio_np: np.ndarray) -> str:
        result = self._whisper.transcribe(audio_np, language=self.config["language"], fp16=False)
        return result["text"].strip()

    def _asr_api(self, wav_path: str) -> str:
        """Call OpenAI-compatible Speech-to-Text API."""
        import urllib.request
        import urllib.error

        url = self.config["asr_api_url"]
        key = self.config["asr_api_key"]
        model = self.config["asr_api_model"]

        if not url or not key:
            self.send("error", message="ASR API 未配置 (url/key)")
            return ""

        # Multipart form upload
        with open(wav_path, "rb") as f:
            audio_bytes = f.read()

        boundary = "----VoiceTyperBoundary"
        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n'
            f"Content-Type: audio/wav\r\n\r\n"
        ).encode() + audio_bytes + (
            f"\r\n--{boundary}\r\n"
            f'Content-Disposition: form-data; name="model"\r\n\r\n'
            f"{model}\r\n"
            f"--{boundary}--\r\n"
        ).encode()

        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode())
                return result.get("text", "").strip()
        except Exception as e:
            self.send("error", message=f"ASR API 调用失败: {e}")
            return ""

    # ===== LLM Polishing =====

    def polish(self, text: str, mode: str = "normal") -> str:
        backend = self.config["llm_backend"]
        sys_prompt = TRANSLATE_SYSTEM_PROMPT if mode == "translate" else POLISH_SYSTEM_PROMPT

        if backend == "api":
            return self._polish_api(text, sys_prompt)
        else:
            return self._polish_ollama(text, sys_prompt)

    def _polish_ollama(self, text: str, sys_prompt: str) -> str:
        try:
            import ollama
            import re

            resp = ollama.chat(
                model=self.config["llm_local_model"],
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": f"需要处理的文本：\n{text}"},
                ],
                think=False,  # Officially disable thinking mode
                options={"temperature": 0.2, "num_predict": len(text) * 3},
            )
            result = resp["message"]["content"].strip()

            # Safety: strip any residual <think>...</think> tags
            result = re.sub(r'<think>.*?</think>', '', result, flags=re.DOTALL).strip()

            return result if result else text
        except Exception as e:
            self.send("error", message=f"Ollama 润色失败: {e}")
            return text

    def _polish_api(self, text: str, sys_prompt: str) -> str:
        """Call OpenAI-compatible Chat API for polishing/translating."""
        import urllib.request

        url = self.config["llm_api_url"]
        key = self.config["llm_api_key"]
        model = self.config["llm_api_model"]

        if not url or not key:
            self.send("error", message="LLM API 未配置")
            return text

        # Ensure the URL points to the chat completions endpoint
        url = url.rstrip('/')
        if not url.endswith('/chat/completions'):
            url = f"{url}/chat/completions"

        # deepseek-chat (V3) has no thinking mode by default.
        # For deepseek-reasoner (R1): disable thinking via thinking=disabled.
        extra: dict = {}
        if "reasoner" in model.lower() or "r1" in model.lower():
            extra["thinking"] = {"type": "disabled"}

        payload = json.dumps({
            "model": model,
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": f"需要处理的文本：\n{text}"},
            ],
            "temperature": 0.2,
            "max_tokens": max(256, len(text) * 3),
            **extra,
        }).encode()

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode())
                content = result["choices"][0]["message"]["content"].strip()
                return content if content else text
        except Exception as e:
            self.send("error", message=f"LLM API 调用失败: {e}")
            return text

    # ===== Text Input =====

    def type_text(self, text: str):
        try:
            import pyperclip
            import pyautogui
            import time
            pyperclip.copy(text)
            time.sleep(0.05)  # Allow OS clipboard to settle
            pyautogui.hotkey("ctrl", "v")
        except Exception as e:
            self.send("error", message=f"输入失败: {e}")

    # ===== Command Handler =====

    def handle(self, data: dict):
        cmd = data.get("cmd", "")
        if cmd == "ping":
            self.send("pong")
        elif cmd == "start_recording":
            # start_recording is safe in a thread (just opens audio stream)
            self.current_recording_mode = data.get("mode", "normal")
            threading.Thread(target=self.start_recording, daemon=True).start()
        elif cmd == "stop_recording":
            # Capture audio and close stream HERE (fast, safe)
            # Actual ASR processing deferred to main thread via _pending_audio
            if self.is_recording:
                self.is_recording = False
                stream = self.stream
                self.stream = None
                audio_data = self.audio_data
                self.audio_data = []
                if stream:
                    try:
                        stream.stop()
                        stream.close()
                    except Exception:
                        pass
                self._pending_audio = audio_data
                self.send("recording_stopped")
        elif cmd == "set_config":
            old_asr = self.config["asr_backend"]
            old_llm = self.config["llm_backend"]
            patch = data.get("config", {})
            self.config.update(patch)
            asr_related_keys = {"asr_backend", "asr_local_model"}
            if self.config["asr_backend"] != old_asr or any(k in patch for k in asr_related_keys):
                self.load_asr()
            llm_related_keys = {"llm_backend", "llm_local_model", "llm_api_url", "llm_api_key", "llm_api_model", "polish_enabled"}
            if self.config["llm_backend"] != old_llm or any(k in patch for k in llm_related_keys):
                self.check_llm()
            self.send("config_updated", config=self.config)
        elif cmd == "get_config":
            self.send("config_updated", config=self.config)
        elif cmd == "quit":
            sys.exit(0)
        else:
            self.send("error", message=f"未知命令: {cmd}")

    def _process_pending(self):
        """Process pending audio on the main thread."""
        audio_data = self._pending_audio
        self._pending_audio = None
        if audio_data is None:
            return

        # Ensure we always clear the processing state on the frontend
        def finish(text=""):
            self.send("finished", text=text)

        if not audio_data:
            self.send("transcription", text="", is_silent=True)
            finish()
            return

        try:
            audio = np.concatenate(audio_data, axis=0).flatten()
        except Exception as e:
            self.send("error", message=f"音频处理失败: {e}")
            finish()
            return

        if np.max(np.abs(audio)) < 0.01:
            self.send("transcription", text="", is_silent=True)
            finish()
            return

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                temp_path = f.name
                wavfile.write(temp_path, self.sample_rate, (audio * 32767).astype(np.int16))

            self.send("status", message="识别中...")
            raw = self.transcribe(temp_path, audio)
            if not raw.strip() or not self._has_meaningful_text(raw):
                self.send("transcription", text="", is_silent=True)
                finish()
                self.send("status", message="引擎就绪")
                return

            self.send("transcription", text=raw)

            final = raw
            if raw.strip():
                wants_translate = self.current_recording_mode == "translate"
                wants_polish = self.config["polish_enabled"]

                if wants_translate and not self.llm_available:
                    self.send("status", message="翻译不可用：请先配置 LLM")
                elif (wants_polish or wants_translate) and self.llm_available:
                    if self.current_recording_mode == "translate":
                        self.send("status", message="翻译中...")
                    else:
                        self.send("status", message="润色中...")
                    
                    polished = self.polish(raw, mode=self.current_recording_mode)
                    self.send("polished", text=polished)
                    final = polished
                else:
                    final = raw

                if self.config["auto_type"]:
                    self.type_text(final)
                    self.send("typed", text=final)
            
            finish(final)
            self.send("status", message="引擎就绪")
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send("error", message=f"处理失败: {e}")
            finish()
        finally:
            if temp_path:
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass

    # ===== Main =====

    def run(self):
        import queue

        self._pending_audio = None
        cmd_queue = queue.Queue()

        # Load config
        config_path = os.path.join(os.environ.get("LOCALAPPDATA", ""), "VoiceTyper", "engine_config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    self.config.update(saved)
                    self.send("status", message="已加载保存的配置")
            except Exception:
                pass

        self.load_asr()
        self.check_llm()
        self.send("ready", config=self.config)

        # Stdin reader thread: safely reads lines and pushes to queue
        def stdin_reader():
            try:
                for line in sys.stdin:
                    line = line.strip()
                    if line:
                        cmd_queue.put(line)
            except (EOFError, OSError):
                pass
            cmd_queue.put(None)  # Sentinel: stdin closed

        reader = threading.Thread(target=stdin_reader, daemon=True)
        reader.start()

        # Main loop: processes commands from queue + pending audio
        while True:
            # 1) Process pending audio on main thread
            if self._pending_audio is not None:
                self._process_pending()

            # 2) Check for commands (50ms timeout)
            try:
                line = cmd_queue.get(timeout=0.05)
            except queue.Empty:
                continue

            if line is None:
                break  # stdin closed

            try:
                self.handle(json.loads(line))
            except json.JSONDecodeError:
                self.send("error", message=f"JSON 解析失败: {line}")
            except Exception as e:
                self.send("error", message=f"执行失败: {e}")


if __name__ == "__main__":
    VoiceEngine().run()

