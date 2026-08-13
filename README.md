<img width="523" height="531" alt="Screenshot 2026-08-13 202253" src="https://github.com/user-attachments/assets/cbe7157c-b192-4871-8977-a3fa3541d747" />


# Ping-Pong Loop Studio 🔁
> Dedicated Custom-Length Voice & Audio Loop Recorder for Desktop & Web

**Ping-Pong Loop Studio** is a focused, high-performance continuous audio loop application. It records for a user-customizable duration (e.g. 1s to 120s), immediately plays back the audio with live waveform visualization, and seamlessly repeats in a continuous ping-pong cycle.

---

## 🌟 Key Features

- **🔁 Dedicated Ping-Pong Loop Workflow**: Records for N seconds, replays the captured clip for N seconds, and continuously repeats until stopped.
- **🌊 Real-Time Magnitude in Playback & Recording**: Live waveform canvas oscilloscope and decibel VU level meter display real-time audio magnitude during **both** recording and playback phases.
- **📐 Compact 400x400 Window**: Starts as a compact, non-intrusive 400x400 utility desktop window.
- **⏱️ Customizable Loop Time**: Enter any custom loop duration (1 to 120 seconds) or select quick presets (`2s`, `5s`, `10s`, `15s`, `30s`, `60s`).
- **🔒 Zero Storage Accumulation**: Audio chunks are processed live in-memory and immediately revoked upon phase completion—no permanent files or database storage required.
- **🖤 Minimalist Black Theme**: Sleek, high-contrast dark aesthetic built with pure pitch black (`#000000`) and subtle zinc accents (`#27272a`).
- **⚡ Hardware & GPU Optimized**: Ultra-low GPU rendering engine removing Canvas 2D shadow blurs and leveraging GPU hardware accelerated CSS transforms (`scaleX`).
- **🎙️ Flexible Audio Sources**: Input device selector supporting external microphones, built-in mics, and PC System Audio loopback.
- **💻 Desktop App Ready**: Native Electron container support with custom Windows titlebar controls.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Spacebar</kbd> | Start / Stop Ping-Pong Loop |
| <kbd>Esc</kbd> | Stop Ping-Pong Loop |

---

## 🛠️ Building & Running Instructions

### 1. Prerequisites
Ensure [Node.js](https://nodejs.org/) (v18 or higher) and `npm` are installed on your system.

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
Start the interactive Vite development server:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173/`.

### 4. Rebuild Web Production App
To rebuild the production web bundle into the `dist/` directory:
```bash
npm run build
```

> [!TIP]
> **Windows PowerShell Note**: If your Windows PowerShell blocks running `npm` scripts due to execution policy settings (`PSSecurityException`), run the build via Command Prompt:
> ```cmd
> cmd /c "npm run build"
> ```

### 5. Desktop Application (Electron)

- **Launch Desktop Dev Mode**:
  ```bash
  npm run electron:dev
  ```

- **Package Standalone Windows `.exe` Desktop App**:
  To package the standalone Windows desktop application into the `dist-win/` folder:
  ```bash
  npm run package:win
  ```
  *(or `cmd /c "npm run package:win"`)*

---

## 🚀 Publishing to GitHub

To push this repository to your GitHub account:

```bash
# 1. Set your Git identity (if not already configured)
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 2. Stage & Commit
git add .
git commit -m "Initial commit of Ping-Pong Loop Studio"

# 3. Connect & Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

---

## 📁 Project Structure

```
voice-recorder-app/
├── dist/               # Production build output
├── dist-win/           # Packaged Windows desktop executable output
├── electron/           # Electron desktop container (main.cjs, preload.cjs)
├── index.html          # Application layout structure
├── style.css           # Minimalist 400x400 black design system & GPU styling
├── app.js              # Modular Ping-Pong loop state controller
├── audio-engine.js     # Web Audio API engine
├── visualizer.js       # Waveform visualizer engine
├── package.json        # Project metadata, dependencies & scripts
├── .gitignore          # Git exclusion rules
└── README.md           # Documentation & instructions
```
