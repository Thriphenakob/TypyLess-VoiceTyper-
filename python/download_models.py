"""
VoiceTyper Model Downloader
============================
Downloads and verifies all required models.

Usage:
  python download_models.py
  python download_models.py --all-whisper
"""

import subprocess
import sys
import os


def check_python_deps():
    """Check if Python dependencies are installed."""
    print("📦 检查 Python 依赖...")
    try:
        import whisper
        import torch
        import sounddevice
        import ollama
        print("   ✅ Python 依赖已安装")
        return True
    except ImportError as e:
        print(f"   ❌ 缺少依赖: {e}")
        print("   💡 运行: pip install -r requirements.txt")
        return False


def download_asr_model(size="base"):
    """Download local Whisper ASR model."""
    size = (size or "base").strip().lower()
    if size not in {"tiny", "base", "small"}:
        size = "base"

    print(f"\n🎙️ 下载 Whisper {size} 语音识别模型...")
    try:
        import whisper
        print(f"   下载中: whisper-{size} (首次下载较慢)")
        whisper.load_model(size)
        print(f"   ✅ whisper-{size} 下载完成")
        return True
    except Exception as e:
        print(f"   ❌ 下载失败: {e}")
        print("   💡 检查网络连接后重试")
        return False


def setup_ollama():
    """Check Ollama and pull the LLM model."""
    print("\n🤖 配置 Ollama + Qwen 3.5...")

    # Check if Ollama is installed
    try:
        result = subprocess.run(["ollama", "--version"], capture_output=True, text=True, timeout=10)
        print(f"   ✅ Ollama 已安装: {result.stdout.strip()}")
    except FileNotFoundError:
        print("   ❌ Ollama 未安装")
        print("   💡 请从 https://ollama.com/download 下载安装")
        print("   💡 安装后重新运行此脚本")
        return False
    except Exception as e:
        print(f"   ❌ Ollama 检查失败: {e}")
        return False

    # Pull the model
    model = "qwen3.5:4b"
    print(f"\n   下载模型: {model} (约 2.7GB)")
    print("   这可能需要几分钟...\n")

    try:
        result = subprocess.run(
            ["ollama", "pull", model],
            timeout=600,  # 10 min timeout
        )
        if result.returncode == 0:
            print(f"\n   ✅ {model} 下载完成")
            return True
        else:
            print(f"\n   ❌ 下载失败 (exit code: {result.returncode})")
            return False
    except subprocess.TimeoutExpired:
        print("\n   ❌ 下载超时，请手动运行: ollama pull qwen3.5:4b")
        return False


def main():
    print("=" * 50)
    print("🎙️ VoiceTyper 模型下载器")
    print("=" * 50)

    download_all_whisper = "--all-whisper" in sys.argv

    results = []
    results.append(("Python 依赖", check_python_deps()))
    results.append(("Whisper Base 语音模型（默认）", download_asr_model("base")))
    if download_all_whisper:
        results.append(("Whisper Tiny 语音模型", download_asr_model("tiny")))
        results.append(("Whisper Small 语音模型", download_asr_model("small")))
    results.append(("Ollama + Qwen 3.5 润色模型", setup_ollama()))

    print("\n" + "=" * 50)
    print("📋 结果汇总")
    print("=" * 50)
    all_ok = True
    for name, ok in results:
        status = "✅" if ok else "❌"
        print(f"  {status} {name}")
        if not ok:
            all_ok = False

    if all_ok:
        print("\n🎉 全部就绪！运行以下命令启动:")
        print("   cd .. && npm run dev && npx electron .")
    else:
        print("\n⚠️ 部分组件未就绪，请根据上方提示修复后重试。")
        print("   💡 如只需语音听写，可先确保 Whisper Base 下载成功。")

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
