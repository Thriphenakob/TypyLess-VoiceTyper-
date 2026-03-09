# VoiceTyper 🎙️
桌面端语音输入助手（Electron + React + Python），最开始用typeless发现要米，穷大学生付不起，练练手搞一个得了🐖🐖

## 🖼️ 语音转文字

![VoiceTyper Preview](assets/images/image.png)

## 🚦 两种使用方式

- 普通用户（直接用）：下载 GitHub Releases 里的安装包，安装后配置即可使用。
- 开发者（改代码）：拉源码后按命令运行、调试、打包。

## 👤 普通用户（Release 版）

### 1) 从 GitHub 下载

- 打开仓库的 `Releases` 页面
- 下载 `VoiceTyper Setup <version>.exe`

### 2) 安装并启动

- 双击安装包完成安装
- 启动 `VoiceTyper`

### 3) 首次使用必做

- 安装 Python 3.10+ 并加入 PATH
- 安装依赖（一次）：

```powershell
python -m pip install openai-whisper torch sounddevice numpy scipy ollama pyautogui pyperclip
```

- 可选：提前下载本地 ASR 模型（tiny/base/small 可选）：
( tiny / base / small 下载后大致分别是 75 MB、142 MB、466 MB，按需下载 )

```powershell
python -c "import whisper; whisper.load_model('base')"
```

### 4) 翻译功能说明

- 不配置 LLM：只做语音识别（听写）
- 配置 LLM（本地 Ollama 或 API）：可用翻译与润色

## 👨‍💻 开发者（源码版）

核心能力：
- 全局热键录音（普通输入 / 免提 / 翻译）
- 本地或 API 语音识别（ASR）
- 本地或 API 文本润色（LLM）
- 自动把结果输入到当前光标位置

## 🧩 技术架构

- 前端 UI：React + Vite（`src/`）
- 桌面主进程：Electron（`electron/main.cjs`）
- Python 引擎：录音、识别、润色、自动输入（`python/engine.py`）
- 数据存储：
  - UI 配置/历史：浏览器 `localStorage`
  - 引擎配置读取路径：`%LOCALAPPDATA%\VoiceTyper\engine_config.json`（如存在）
  - 主进程日志：`%LOCALAPPDATA%\VoiceTyper\logs\main-YYYY-MM-DD.log`

## ✨ 功能模式

- 语音输入：普通听写
- 免提模式：按一次开始，再按一次停止
- 翻译模式：识别后翻译再输入
- 按住录音模式：在设置中开启后，语音输入/翻译都支持“按下开始，松开停止”

## 🛠️ 本地开发（推荐）

### 1) 环境要求

- Node.js 20+
- Python 3.10+（命令行可直接运行 `python`）
- Windows 10/11（当前默认打包配置为 Windows NSIS）

### 2) 安装依赖

```powershell
npm install
python -m pip install -r python/requirements.txt
```

如果你要用本地 LLM 润色，还需要安装 Ollama，并拉取模型：

```powershell
ollama pull qwen3.5:4b
```

### 3) 启动应用

开发模式（前端热更新 + Electron）：

```powershell
npm run electron:dev
```

本地生产模式（先构建再启动 Electron）：

```powershell
npm run electron:start
```

注意：`npm run preview` 只会启动 Vite 预览服务，不会完整启动 Electron + Python 语音链路。

## ⚙️ 配置 ASR/LLM（重点）

在应用中打开：`设置 -> AI 引擎`。

### ASR（语音识别）

- `本地`：使用本地模型（默认）
- `API`：填写以下 3 项
  - API 地址（示例：`https://api.openai.com/v1/audio/transcriptions`）
  - API Key
  - 模型名（示例：`whisper-1`）

本地 ASR 提供 3 档 Whisper 选择（可在设置页切换）：

- `whisper-tiny`：最快、最省资源，准确率相对最低
- `whisper-base`：速度与准确率平衡，默认推荐
- `whisper-small`：准确率更高，但更慢、更占资源

首次安装改为手动触发：

- 打开 `设置 -> AI 引擎 -> 语音识别(ASR)`
- 选择 `tiny/base/small`
- 点击“安装 TINY/BASE/SMALL”
- 下载过程中会显示实时进度条（百分比、大小、速度）

你也可以提前手动下载：

```powershell
python -c "import whisper; whisper.load_model('tiny')"
python -c "import whisper; whisper.load_model('base')"
python -c "import whisper; whisper.load_model('small')"
```

可选：在设置页填写“本地模型路径”：

- 填 `.pt` 文件路径：直接加载该模型文件
- 填目录路径：优先读取该目录中的模型；不存在时下载到该目录

### LLM（文本润色/翻译）

- `本地`：通过 Ollama 调用本地模型
- `API`：填写以下 3 项
  - API 地址（OpenAI 兼容接口）
  - API Key
  - 模型名（如 `deepseek-chat`、`qwen-plus`、`glm-4-flash`、`gpt-4o-mini`）

### 🔐 关于 API Key 是否会跟随安装包

不会默认跟随你的 Key。每个用户在自己机器上独立配置。

仍然建议：
- 不要把任何真实 key 写进源码
- 不要上传本机 `%LOCALAPPDATA%\VoiceTyper\engine_config.json`
- 如果 key 曾暴露，立即去服务商后台轮换

## 📦 打包 EXE

```powershell
npm run electron:build
```

输出目录：`release/`

常见文件：
- `release/VoiceTyper Setup <version>.exe`
- `release/win-unpacked/VoiceTyper.exe`

## 📤 发布 Release 给用户

推荐每次发布都做这 4 步：

1. 本地验证

```powershell
npm run build
python -m py_compile python/engine.py
```

2. 生成安装包

```powershell
npm run electron:build
```

3. 上传到 GitHub Releases

- 新建 Tag（如 `v0.1.1`）
- 上传 `release/VoiceTyper Setup <version>.exe`

4. 在 Release 说明里附上“首次使用必做”（Python + 依赖）

## 🙋 常见问题

### 别人只下载 `release` 里的安装包，能直接用吗？

可以安装，但不一定“开箱即用”。当前版本还依赖系统 Python 环境。

- 最低要求：
  - 安装 Python 3.10+（并加入 PATH）
  - 安装 Python 依赖：`pip install -r python/requirements.txt`
- 如使用本地润色模型：
  - 还需安装 Ollama，并拉取模型（例如 `ollama pull qwen3.5:4b`）

结论：
- `release/VoiceTyper Setup x.x.x.exe` 可以直接安装应用本体
- 但若目标机器没有 Python/依赖，录音识别会失败

如果你希望“只下载安装包就完整可用”，下一步需要把 Python 运行时和依赖一起打进安装包（做真正的一键版）。

- 热键注册失败：换成组合键（如 `Alt+T`）或 `F1~F12`
- 录音无结果：检查系统麦克风权限、输入设备是否正确、日志是否报错
- 润色不生效：检查 `LLM` 后端是否可用，或先关闭“自动润色”排查 ASR 本身

## 🗂️ 项目结构

```text
electron/        Electron 主进程与 preload
python/          语音引擎（录音/ASR/LLM/自动输入）
src/             React 前端界面
dist/            前端构建产物（自动生成）
release/         安装包产物（自动生成）
```

## 🚀 开源发布建议

1. 先确认没有提交任何密钥或本地配置。
2. 保留 `.gitignore` 中对 `node_modules/ dist/ release/ .env*` 的忽略。
3. 再推送到 GitHub。

示例：

```powershell
git init
git add .
git commit -m "feat: open source VoiceTyper"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```
