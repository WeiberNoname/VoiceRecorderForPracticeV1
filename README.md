<img width="523" height="531" alt="Screenshot 2026-08-13 202253" src="https://github.com/user-attachments/assets/cbe7157c-b192-4871-8977-a3fa3541d747" />


# Ping-Pong Loop Studio 🔁
> Dedicated Custom-Length Voice & Audio Loop Recorder for Desktop & Web with Local Whisper STT & Diagnostics

**Ping-Pong Loop Studio** is a focused, high-performance continuous audio loop application. It records for a user-customizable duration (e.g. 1s to 120s), immediately plays back the audio with live waveform visualization, and seamlessly repeats in a continuous ping-pong cycle. 

It features an in-memory **Local Whisper WASM Voice Translator** panel to convert spoken English voice clips into text and translate them into 12+ target languages in real-time, plus a built-in **System Diagnostics & STT Debug Console** to test every audio & translation engine on demand.

---

## 🌟 Key Features

- **🔁 Dedicated Ping-Pong Loop Workflow**: Records for N seconds, replays the captured clip for N seconds, and continuously repeats until stopped.
- **🧠 Local WASM Whisper Speech Transcriber**: 100% in-memory local speech-to-text decoding via `@xenova/transformers` (`Xenova/whisper-tiny.en`). Runs 100% offline with zero cloud API keys, zero CORS restrictions, and zero network errors.
- **🌐 English Voice Translator Panel**: Single-record mode with a **3-second tail countdown buffer** (`Finishing in 3s...`) to guarantee complete sentence audio capture without truncation, plus instant translation into 12+ target languages with Text-to-Speech (TTS) voice playback.
- **🛠️ Automated Diagnostics Debug Console**: In-app test suite running 6 automated diagnostic checks (microphones, PCM resampler, Whisper WASM model, Web Speech API, Translation REST API latency, Electron IPC bridge) with live `PASS`/`FAIL` badges and latency metrics in milliseconds.
- **🌊 Live Audio Magnitude Meter**: Real-time oscilloscope canvas and decibel VU level meter bar (`-inf dB` to `0 dB`) during both recording and playback phases.
- **📐 Compact 400x400 Window**: Starts as a compact, non-intrusive 400x400 utility desktop window.
- **⏱️ Customizable Loop Time**: Enter any custom loop duration (1 to 120 seconds) or select quick presets (`2s`, `5s`, `10s`, `15s`, `30s`, `60s`).
- **🔒 Zero Storage Accumulation**: Audio chunks are processed live in-memory and immediately revoked upon phase completion—no permanent files or database storage required.
- **🖤 Minimalist Black Theme**: Sleek, high-contrast dark aesthetic built with pure pitch black (`#000000`) and zinc accents (`#27272a`).
- **💻 Desktop App Ready**: Native Electron container support with custom Windows titlebar controls.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Spacebar</kbd> | Start / Stop Ping-Pong Loop |
| <kbd>Esc</kbd> | Stop Loop / Close Translator & Debug Panels |
| <kbd>T</kbd> | Open / Close English Voice Translator Panel |
| <kbd>D</kbd> | Open / Close System Diagnostics Debug Console |

---

## 🛠️ How to Rebuild this App from GitHub

Follow these simple, step-by-step instructions to clone, install, and rebuild the application from GitHub on any machine.

### 1. Prerequisites
- Install [Node.js](https://nodejs.org/) (v18.0.0 or higher).
- Install [Git](https://git-scm.com/).

### 2. Clone Repository from GitHub
Open your terminal or Windows Command Prompt and run:
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### 3. Install All Dependencies
Install all required Node.js, Electron, and `@xenova/transformers` dependencies:
```bash
npm install
```

### 4. Rebuild the Application

#### 🌐 Option A: Rebuild Web Production Bundle (`dist/`)
To compile the optimized Web application bundle into the `dist/` directory:
```bash
npm run build
```

#### 💻 Option B: Package Standalone Windows Desktop App (`dist-win/`)
To package the native Windows desktop executable (`PingPongLoopStudio.exe`) into `dist-win/PingPongLoopStudio-win32-x64/`:
```bash
npm run package:win
```

> [!TIP]
> **Windows PowerShell Execution Policy Note**: If PowerShell blocks running `npm` scripts due to execution policies (`PSSecurityException`), run the build via Windows Command Prompt (`cmd.exe`):
> ```cmd
> cmd /c "npm run package:win"
> ```

---

## 🏃 Running & Development Modes

- **Interactive Web Development Mode**:
  ```bash
  npm run dev
  ```
  Open `http://localhost:5173/` in your browser.

- **Desktop Electron Development Mode**:
  ```bash
  npm run electron:dev
  ```

- **Launch Built Windows Desktop Executable**:
  Once packaged via `npm run package:win`, launch the native desktop application directly:
  ```cmd
  dist-win\PingPongLoopStudio-win32-x64\PingPongLoopStudio.exe
  ```
  *(or double click `Run_SoundPulse_Studio.bat`)*

---

## 🚀 Publishing to GitHub

To push local modifications to a new or existing GitHub repository:

```bash
# 1. Initialize & set Git identity
git init
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 2. Stage & Commit files
git add .
git commit -m "Build Ping-Pong Loop Studio with Local Whisper STT & Diagnostics"

# 3. Add Remote & Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

---

## 📁 Project Structure

```
voice-recorder-app/
├── dist/                   # Production Web build output (generated by npm run build)
├── dist-win/               # Packaged Windows desktop executable (generated by npm run package:win)
├── electron/               # Electron desktop container (main.cjs, preload.cjs)
├── index.html              # Application layout structure & panels
├── style.css               # Minimalist 400x400 pitch-black design system
├── app.js                  # Main Ping-Pong loop & UI orchestrator
├── audio-engine.js         # Web Audio API & MediaRecorder stream manager
├── translator-engine.js    # Voice-to-Text, translation & TTS engine
├── local-whisper-engine.js # Local Whisper WASM STT engine (@xenova/transformers)
├── debug-engine.js         # Automated System Diagnostics test engine (Tests 1-6)
├── visualizer.js           # Real-time oscilloscope visualizer engine
├── package.json            # Dependencies, scripts & build configuration
├── vite.config.js          # Vite build & WebAssembly bundler config
└── README.md               # Documentation & instructions
```
