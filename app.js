/**
 * Voice Recorder - Ping-Pong Loop Studio Controller
 * Modern, Maintainable, Modular Architecture
 */
import { AudioEngine } from './audio-engine.js';
import { Visualizer } from './visualizer.js';
import { TranslatorEngine, SUPPORTED_LANGUAGES } from './translator-engine.js';
import { DebugEngine } from './debug-engine.js';

/** Loop Phase Constants */
export const LOOP_PHASE = Object.freeze({
  IDLE: 'IDLE',
  RECORDING: 'RECORDING',
  PLAYING: 'PLAYING'
});

/** Default Configuration */
const CONFIG = {
  DEFAULT_DURATION_MS: 5000,
  MIN_DURATION_SEC: 1,
  MAX_DURATION_SEC: 120,
  TIMER_UPDATE_INTERVAL_MS: 40
};

/**
 * UI View Manager
 * Encapsulates DOM element references and UI view updates
 */
class UIView {
  constructor() {
    this.elements = {
      windowTitlebar: document.getElementById('window-titlebar'),
      btnWinMinimize: document.getElementById('btn-win-minimize'),
      btnWinMaximize: document.getElementById('btn-win-maximize'),
      btnWinClose: document.getElementById('btn-win-close'),

      micSelect: document.getElementById('mic-select'),
      btnRefreshDevices: document.getElementById('btn-refresh-devices'),
      recordingStatus: document.getElementById('recording-status'),
      statusText: document.getElementById('status-text'),

      timerHours: document.getElementById('timer-hours'),
      timerMinutes: document.getElementById('timer-minutes'),
      timerSeconds: document.getElementById('timer-seconds'),
      timerMillis: document.getElementById('timer-millis'),

      canvasWrapper: document.getElementById('canvas-wrapper'),
      visualizerCanvas: document.getElementById('visualizer-canvas'),
      vuFill: document.getElementById('vu-fill'),
      vuLabel: document.getElementById('vu-label'),

      loopSecondsInput: document.getElementById('loop-seconds-input'),
      presetChips: document.querySelectorAll('.preset-chip'),
      btnToggleLoop: document.getElementById('btn-toggle-loop'),
      loopBtnText: document.getElementById('loop-btn-text'),
      loopBtnIcon: document.getElementById('loop-btn-icon'),

      // Translator Elements
      btnToggleTranslator: document.getElementById('btn-toggle-translator'),
      translatorPanel: document.getElementById('translator-panel'),
      btnCloseTranslator: document.getElementById('btn-close-translator'),
      translatorLangSelect: document.getElementById('translator-lang-select'),
      translatorStatus: document.getElementById('translator-status'),
      translatorStatusText: document.getElementById('translator-status-text'),
      translatorVuFill: document.getElementById('translator-vu-fill'),
      translatorVuLabel: document.getElementById('translator-vu-label'),
      translatorTranscriptBox: document.getElementById('translator-transcript-box'),
      translatorResultBox: document.getElementById('translator-result-box'),
      btnCopyTranscript: document.getElementById('btn-copy-transcript'),
      btnCopyTranslation: document.getElementById('btn-copy-translation'),
      btnSpeakTranslation: document.getElementById('btn-speak-translation'),
      btnStartTranslateRecord: document.getElementById('btn-start-translate-record'),
      btnStopTranslateRecord: document.getElementById('btn-stop-translate-record'),
      btnClearTranslator: document.getElementById('btn-clear-translator'),

      // Debugging Panel Elements
      btnToggleDebug: document.getElementById('btn-toggle-debug'),
      debugPanel: document.getElementById('debug-panel'),
      btnCloseDebug: document.getElementById('btn-close-debug'),
      btnRunDiagnostics: document.getElementById('btn-run-diagnostics'),
      debugOverallStatus: document.getElementById('debug-overall-status'),
      debugOverallText: document.getElementById('debug-overall-text'),
      debugLogBox: document.getElementById('debug-log-box'),
      btnClearDebugLog: document.getElementById('btn-clear-debug-log')
    };
  }

  /** Update Status Badge */
  setStatus(text, stateClass) {
    if (this.elements.statusText) this.elements.statusText.textContent = text;
    if (this.elements.recordingStatus) {
      this.elements.recordingStatus.className = `status-pill ${stateClass}`;
    }
  }

  /** Format & Update Digital Timer Display */
  setTimerDisplay(remainingMs) {
    const totalSec = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const millis = Math.floor((remainingMs % 1000) / 10);

    if (this.elements.timerHours) this.elements.timerHours.textContent = String(hours).padStart(2, '0');
    if (this.elements.timerMinutes) this.elements.timerMinutes.textContent = String(minutes).padStart(2, '0');
    if (this.elements.timerSeconds) this.elements.timerSeconds.textContent = String(seconds).padStart(2, '0');
    if (this.elements.timerMillis) this.elements.timerMillis.textContent = String(millis).padStart(2, '0');
  }

  /** Reset Timer to Selected Loop Duration */
  resetTimerDisplay(durationMs = CONFIG.DEFAULT_DURATION_MS) {
    this.setTimerDisplay(durationMs);
  }

  /** GPU-Accelerated Main Visualizer VU Level Meter Update */
  setVUMeter(db) {
    if (!this.elements.vuFill || !this.elements.vuLabel) return;
    const minDb = -60;
    const maxDb = 0;
    const clampedDb = Math.max(minDb, Math.min(maxDb, db));
    const percent = Math.max(0, ((clampedDb - minDb) / (maxDb - minDb)) * 100);
    const scale = percent / 100;

    this.elements.vuFill.style.transform = `scaleX(${scale})`;
    this.elements.vuLabel.textContent = db <= minDb ? '-inf dB' : `${Math.round(db)} dB`;
  }

  /** GPU-Accelerated Translator Panel Magnitude Meter Update */
  setTranslatorVUMeter(db) {
    if (!this.elements.translatorVuFill || !this.elements.translatorVuLabel) return;
    const minDb = -60;
    const maxDb = 0;
    const clampedDb = Math.max(minDb, Math.min(maxDb, db));
    const percent = Math.max(0, ((clampedDb - minDb) / (maxDb - minDb)) * 100);
    const scale = percent / 100;

    this.elements.translatorVuFill.style.transform = `scaleX(${scale})`;
    this.elements.translatorVuLabel.textContent = db <= minDb ? 'Magnitude: -inf dB' : `Magnitude: ${Math.round(db)} dB`;
  }

  /** Toggle Hero Control Button Active State */
  setLoopButtonState(isLooping) {
    const btn = this.elements.btnToggleLoop;
    const text = this.elements.loopBtnText;
    const icon = this.elements.loopBtnIcon;

    if (!btn || !text || !icon) return;

    if (isLooping) {
      btn.classList.add('recording-active');
      text.textContent = 'STOP PING-PONG LOOP';
      icon.setAttribute('data-lucide', 'square');
    } else {
      btn.classList.remove('recording-active');
      text.textContent = 'START PING-PONG LOOP';
      icon.setAttribute('data-lucide', 'play');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  /** Highlight Selected Preset Chip */
  setPresetActive(seconds) {
    this.elements.presetChips.forEach((chip) => {
      const chipSec = parseInt(chip.getAttribute('data-sec'), 10);
      chip.classList.toggle('active', chipSec === seconds);
    });
  }

  /** Enable / Disable Inputs */
  setControlsDisabled(disabled) {
    if (this.elements.loopSecondsInput) {
      this.elements.loopSecondsInput.disabled = disabled;
    }
  }

  /** Update Translator Status & Control Buttons */
  setTranslatorStatus(state, text) {
    const statusPill = this.elements.translatorStatus;
    const statusText = this.elements.translatorStatusText;
    const btnStart = this.elements.btnStartTranslateRecord;
    const btnStop = this.elements.btnStopTranslateRecord;

    if (statusText) statusText.textContent = text;

    if (statusPill) {
      statusPill.className = `status-pill ${state === 'listening' || state === 'error' ? 'recording' : state === 'translating' ? 'paused' : ''}`;
    }

    if (btnStart && btnStop) {
      if (state === 'listening') {
        btnStart.disabled = true;
        btnStart.classList.add('listening-active');
        btnStop.disabled = false;
      } else {
        btnStart.disabled = false;
        btnStart.classList.remove('listening-active');
        btnStop.disabled = true;
      }
    }
  }

  /** Update Debugging Test Card UI */
  updateTestCardUI(result) {
    const card = document.getElementById(`card-${result.id}`);
    if (!card) return;

    const badge = card.querySelector('.badge-status');
    const details = card.querySelector('.test-details');

    if (badge) {
      badge.textContent = result.state;
      badge.className = `badge-status ${result.state.toLowerCase()}`;
    }

    if (details) {
      details.textContent = `${result.details} ${result.elapsedMs ? `(${result.elapsedMs}ms)` : ''}`;
    }
  }

  /** Append Log line to Debug Console Output Box */
  appendDebugLog(msg) {
    const logBox = this.elements.debugLogBox;
    if (!logBox) return;
    if (logBox.textContent.startsWith('Ready.')) logBox.textContent = '';
    logBox.textContent += msg + '\n';
    logBox.scrollTop = logBox.scrollHeight;
  }

  /** Populate Language Select Dropdown */
  populateLanguages() {
    const select = this.elements.translatorLangSelect;
    if (!select) return;

    select.innerHTML = '';
    SUPPORTED_LANGUAGES.forEach(lang => {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.name;
      select.appendChild(opt);
    });
  }
}

/**
 * Main Ping-Pong Loop Application Orchestrator
 */
class LoopApp {
  constructor() {
    this.engine = new AudioEngine();
    this.visualizer = null;
    this.ui = new UIView();
    this.translator = new TranslatorEngine();
    this.debugger = new DebugEngine();

    // Loop Application State
    this.phase = LOOP_PHASE.IDLE;
    this.isLoopRunning = false;
    this.loopDurationMs = CONFIG.DEFAULT_DURATION_MS;

    // Handles & Resources
    this.phaseTimeout = null;
    this.countdownInterval = null;
    this.activeSourceNode = null;
    this.activeAudioElement = null;
    this.activeAudioUrl = null;

    this.init();
  }

  async init() {
    this.setupElectronTitlebar();
    this.setupVisualizer();
    this.setupTranslator();
    this.setupDebug();
    this.bindEvents();
    await this.loadAudioDevices();
    this.ui.resetTimerDisplay(this.loopDurationMs);

    if (window.lucide) window.lucide.createIcons();
  }

  /** Electron Container Setup */
  setupElectronTitlebar() {
    if (window.electronAPI && window.electronAPI.isElectron) {
      if (this.ui.elements.windowTitlebar) {
        this.ui.elements.windowTitlebar.classList.remove('hidden');
      }
      this.ui.elements.btnWinMinimize?.addEventListener('click', () => window.electronAPI.minimizeWindow());
      this.ui.elements.btnWinMaximize?.addEventListener('click', () => window.electronAPI.maximizeWindow());
      this.ui.elements.btnWinClose?.addEventListener('click', () => window.electronAPI.closeWindow());
    }
  }

  /** Waveform Canvas Setup */
  setupVisualizer() {
    const canvas = this.ui.elements.visualizerCanvas;
    if (canvas) {
      this.visualizer = new Visualizer(canvas);
      this.visualizer.drawIdleState();
    }
  }

  /** Translator Setup */
  setupTranslator() {
    this.ui.populateLanguages();

    this.translator.onTranscriptUpdate = (text) => {
      const box = this.ui.elements.translatorTranscriptBox;
      if (!box) return;
      if (text && text.trim()) {
        box.innerText = text;
        box.classList.remove('placeholder');
      } else {
        box.innerText = 'Speak or type in English...';
        box.classList.add('placeholder');
      }
    };

    this.translator.onTranslationUpdate = (text) => {
      const box = this.ui.elements.translatorResultBox;
      if (!box) return;
      if (text) {
        box.textContent = text;
        box.classList.remove('placeholder');
      } else {
        box.textContent = 'Translation result will appear here...';
        box.classList.add('placeholder');
      }
    };

    this.translator.onAudioMagnitudeUpdate = (db, rms) => {
      this.ui.setTranslatorVUMeter(db);
    };

    this.translator.onStatusChange = (state, text) => {
      this.ui.setTranslatorStatus(state, text);
    };

    this.translator.onError = (errText) => {
      this.ui.setTranslatorStatus('error', `⚠️ ${errText}`);
    };
  }

  /** Debugging Engine & UI Setup */
  setupDebug() {
    this.debugger.onTestUpdate = (result) => {
      this.ui.updateTestCardUI(result);
    };

    this.debugger.onLogMessage = (msg) => {
      this.ui.appendDebugLog(msg);
    };
  }

  /** Audio Devices Enumeration */
  async loadAudioDevices() {
    const select = this.ui.elements.micSelect;
    if (!select) return;

    const currentVal = select.value || 'system_audio';
    const devices = await this.engine.getAudioInputs();

    select.innerHTML = '';

    const sysOpt = document.createElement('option');
    sysOpt.value = 'system_audio';
    sysOpt.textContent = '💻 Computer System Audio';
    select.appendChild(sysOpt);

    const defaultOpt = document.createElement('option');
    defaultOpt.value = 'default_mic';
    defaultOpt.textContent = '🎙️ Default Microphone';
    select.appendChild(defaultOpt);

    devices.forEach((d, idx) => {
      if (!d.deviceId) return;
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = `🎙️ ${d.label || 'Microphone ' + (idx + 1)}`;
      select.appendChild(opt);
    });

    if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
      select.value = currentVal;
    } else {
      select.value = 'system_audio';
    }
  }

  /** Event Handlers Binding */
  bindEvents() {
    // Device Selector Events
    this.ui.elements.btnRefreshDevices?.addEventListener('click', () => this.loadAudioDevices());
    if (navigator.mediaDevices && navigator.mediaDevices.ondevicechange !== undefined) {
      navigator.mediaDevices.ondevicechange = () => this.loadAudioDevices();
    }

    // Toggle Loop Button
    this.ui.elements.btnToggleLoop?.addEventListener('click', () => this.toggleLoop());

    // Loop Duration Input Listener
    const secInput = this.ui.elements.loopSecondsInput;
    if (secInput) {
      const handleInput = (e) => this.setLoopDuration(e.target.value);
      secInput.addEventListener('change', handleInput);
      secInput.addEventListener('input', handleInput);
    }

    // Quick Duration Presets
    this.ui.elements.presetChips.forEach((chip) => {
      chip.addEventListener('click', (e) => {
        const sec = parseInt(e.currentTarget.getAttribute('data-sec'), 10);
        if (sec && !isNaN(sec)) {
          if (secInput) secInput.value = sec;
          this.setLoopDuration(sec);
        }
      });
    });

    // Translator Panel Toggle
    const toggleTranslatorPanel = () => {
      const panel = this.ui.elements.translatorPanel;
      if (panel) {
        panel.classList.toggle('hidden');
        this.ui.elements.btnToggleTranslator?.classList.toggle('active', !panel.classList.contains('hidden'));
      }
    };

    // Debugging Panel Toggle
    const toggleDebugPanel = () => {
      const panel = this.ui.elements.debugPanel;
      if (panel) {
        panel.classList.toggle('hidden');
        this.ui.elements.btnToggleDebug?.classList.toggle('active', !panel.classList.contains('hidden'));
      }
    };

    this.ui.elements.btnToggleTranslator?.addEventListener('click', toggleTranslatorPanel);
    this.ui.elements.btnCloseTranslator?.addEventListener('click', toggleTranslatorPanel);

    this.ui.elements.btnToggleDebug?.addEventListener('click', toggleDebugPanel);
    this.ui.elements.btnCloseDebug?.addEventListener('click', toggleDebugPanel);

    this.ui.elements.btnRunDiagnostics?.addEventListener('click', async () => {
      const overallText = this.ui.elements.debugOverallText;
      const overallStatus = this.ui.elements.debugOverallStatus;

      if (overallText) overallText.textContent = 'Running...';
      if (overallStatus) overallStatus.className = 'status-pill paused';

      await this.debugger.runAllDiagnostics();

      if (overallText) overallText.textContent = 'Finished';
      if (overallStatus) overallStatus.className = 'status-pill recording';
    });

    this.ui.elements.btnClearDebugLog?.addEventListener('click', () => {
      const logBox = this.ui.elements.debugLogBox;
      if (logBox) logBox.textContent = 'Log cleared.\n';
    });

    this.ui.elements.translatorLangSelect?.addEventListener('change', (e) => {
      this.translator.setTargetLanguage(e.target.value);
    });

    this.ui.elements.btnStartTranslateRecord?.addEventListener('click', () => {
      this.translator.startSingleRecording();
    });

    this.ui.elements.btnStopTranslateRecord?.addEventListener('click', () => {
      this.translator.stopSingleRecording();
    });

    this.ui.elements.btnClearTranslator?.addEventListener('click', () => {
      this.translator.clear();
      const box = this.ui.elements.translatorTranscriptBox;
      if (box) {
        box.innerText = 'Speak or type in English...';
        box.classList.add('placeholder');
      }
    });

    // Manual typing in English transcript box fallback
    const transcriptBox = this.ui.elements.translatorTranscriptBox;
    if (transcriptBox) {
      transcriptBox.addEventListener('focus', () => {
        if (transcriptBox.innerText === 'Speak or type in English...') {
          transcriptBox.innerText = '';
          transcriptBox.classList.remove('placeholder');
        }
      });

      transcriptBox.addEventListener('blur', () => {
        if (!transcriptBox.innerText.trim()) {
          transcriptBox.innerText = 'Speak or type in English...';
          transcriptBox.classList.add('placeholder');
        }
      });

      let typingTimer = null;
      transcriptBox.addEventListener('input', () => {
        const text = transcriptBox.innerText.trim();
        if (text && text !== 'Speak or type in English...') {
          transcriptBox.classList.remove('placeholder');
          this.translator.transcript = text;
          clearTimeout(typingTimer);
          typingTimer = setTimeout(() => {
            this.translator.translateCurrentText(text);
          }, 350);
        } else {
          transcriptBox.classList.add('placeholder');
          this.translator.clear();
        }
      });
    }

    this.ui.elements.btnCopyTranscript?.addEventListener('click', () => {
      const text = this.translator.transcript || transcriptBox?.innerText.replace('Speak or type in English...', '').trim();
      if (text) {
        navigator.clipboard.writeText(text);
      }
    });

    this.ui.elements.btnCopyTranslation?.addEventListener('click', () => {
      if (this.translator.translation) {
        navigator.clipboard.writeText(this.translator.translation);
      }
    });

    this.ui.elements.btnSpeakTranslation?.addEventListener('click', () => {
      this.translator.speakTranslation();
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.toggleLoop();
      } else if (e.code === 'Escape') {
        if (this.isLoopRunning) {
          e.preventDefault();
          this.stopLoop();
        } else if (this.ui.elements.translatorPanel && !this.ui.elements.translatorPanel.classList.contains('hidden')) {
          e.preventDefault();
          toggleTranslatorPanel();
        } else if (this.ui.elements.debugPanel && !this.ui.elements.debugPanel.classList.contains('hidden')) {
          e.preventDefault();
          toggleDebugPanel();
        }
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        toggleTranslatorPanel();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        toggleDebugPanel();
      }
    });
  }

  /** Set & Validate Loop Duration */
  setLoopDuration(val) {
    let sec = parseInt(val, 10);
    if (isNaN(sec) || sec < CONFIG.MIN_DURATION_SEC) sec = CONFIG.MIN_DURATION_SEC;
    if (sec > CONFIG.MAX_DURATION_SEC) sec = CONFIG.MAX_DURATION_SEC;

    this.loopDurationMs = sec * 1000;
    this.ui.setPresetActive(sec);

    if (!this.isLoopRunning) {
      this.ui.resetTimerDisplay(this.loopDurationMs);
    }
  }

  /** Main Toggle Controller */
  async toggleLoop() {
    if (!this.isLoopRunning) {
      await this.startLoop();
    } else {
      await this.stopLoop();
    }
  }

  /** Start Ping-Pong Loop */
  async startLoop() {
    this.isLoopRunning = true;
    this.ui.setControlsDisabled(true);
    this.ui.setLoopButtonState(true);
    await this.enterRecordPhase();
  }

  /** Step 1: Record Phase Execution */
  async enterRecordPhase() {
    if (!this.isLoopRunning) return;

    this.phase = LOOP_PHASE.RECORDING;
    const durationSec = Math.round(this.loopDurationMs / 1000);
    this.ui.setStatus(`🔴 Loop Recording (${durationSec}s)`, 'recording');

    const select = this.ui.elements.micSelect;
    let deviceId = select ? select.value : 'system_audio';
    if (!deviceId) deviceId = 'system_audio';

    try {
      await this.engine.startRecording(deviceId, true);
      if (this.engine.gainNode) {
        this.engine.gainNode.gain.value = 1.0;
      }

      this.startVisualizer();
      this.startCountdown(this.loopDurationMs, `🔴 Record ${durationSec}s`);

      this.phaseTimeout = setTimeout(async () => {
        if (!this.isLoopRunning || this.phase !== LOOP_PHASE.RECORDING) return;

        this.stopVisualizer();
        this.stopCountdown();

        const result = await this.engine.stopRecording(false);

        if (result && result.blob && this.isLoopRunning) {
          // Automatically transcribe recorded loop voice clip when Translator panel is open
          const panel = this.ui.elements.translatorPanel;
          if (panel && !panel.classList.contains('hidden')) {
            this.translator.transcribeAudioBlob(result.blob);
          }
          await this.enterPlayPhase(result.blob);
        } else if (this.isLoopRunning) {
          await this.enterRecordPhase();
        }
      }, this.loopDurationMs);

    } catch (err) {
      console.error('Ping-Pong loop recording failed:', err);
      alert('Could not start loop recording. Please check microphone or system audio permissions.');
      await this.stopLoop();
    }
  }

  /** Step 2: Play Phase Execution */
  async enterPlayPhase(blob) {
    if (!this.isLoopRunning || !blob) return;

    this.phase = LOOP_PHASE.PLAYING;
    const durationSec = Math.round(this.loopDurationMs / 1000);
    this.ui.setStatus(`🔊 Loop Playing (${durationSec}s)`, 'paused');
    this.startCountdown(this.loopDurationMs, `🔊 Play ${durationSec}s`);

    this.cleanupAudioResources();

    // Mute mic gain node during playback so microphone noise doesn't interfere with visualizer
    if (this.engine.gainNode) {
      this.engine.gainNode.gain.value = 0;
    }

    try {
      await this.engine.initContext();
      const audioBuffer = await this.engine.blobToAudioBuffer(blob);
      if (!this.isLoopRunning) return;

      const sourceNode = this.engine.audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;

      // Connect source to speakers AND analyserNode for real-time waveform visualizer
      sourceNode.connect(this.engine.audioCtx.destination);
      if (this.engine.analyserNode) {
        try { sourceNode.connect(this.engine.analyserNode); } catch (e) { }
      }

      this.activeSourceNode = sourceNode;
      this.startVisualizer();
      sourceNode.start(0);
    } catch (err) {
      console.warn('Audio playback WebAudio fallback attempt:', err);
      this.activeAudioUrl = URL.createObjectURL(blob);
      this.activeAudioElement = new Audio(this.activeAudioUrl);
      try {
        await this.activeAudioElement.play();
      } catch (e) { }
    }

    this.phaseTimeout = setTimeout(async () => {
      if (!this.isLoopRunning || this.phase !== LOOP_PHASE.PLAYING) return;

      this.stopVisualizer();
      this.stopCountdown();
      this.cleanupAudioResources();

      await this.enterRecordPhase();
    }, this.loopDurationMs);
  }

  /** Countdown Timer Runner */
  startCountdown(durationMs, labelPrefix) {
    this.stopCountdown();
    const startTime = Date.now();

    this.countdownInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingMs = Math.max(0, durationMs - elapsed);

      this.ui.setTimerDisplay(remainingMs);
      const seconds = Math.floor(remainingMs / 1000);
      const millis = Math.floor((remainingMs % 1000) / 10);
      const stateClass = this.phase === LOOP_PHASE.RECORDING ? 'recording' : 'paused';

      this.ui.setStatus(`${labelPrefix}: ${seconds}.${String(millis).padStart(2, '0')}s`, stateClass);
    }, CONFIG.TIMER_UPDATE_INTERVAL_MS);
  }

  stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  /** Stop Loop & Clean Up All Resources */
  async stopLoop() {
    this.isLoopRunning = false;
    this.phase = LOOP_PHASE.IDLE;

    if (this.phaseTimeout) {
      clearTimeout(this.phaseTimeout);
      this.phaseTimeout = null;
    }
    this.stopCountdown();
    this.cleanupAudioResources();

    if (this.engine.isRecording) {
      await this.engine.stopRecording(true);
    } else if (this.engine.micStream) {
      this.engine.micStream.getTracks().forEach(t => t.stop());
      this.engine.micStream = null;
    }

    this.stopVisualizer();
    this.ui.resetTimerDisplay(this.loopDurationMs);
    this.ui.setStatus('Ready', 'ready');
    this.ui.setLoopButtonState(false);
    this.ui.setControlsDisabled(false);
  }

  /** Clean Up Audio Playback Resources & Prevent Memory / URL Leaks */
  cleanupAudioResources() {
    if (this.activeSourceNode) {
      try { this.activeSourceNode.stop(); } catch (e) { }
      try { this.activeSourceNode.disconnect(); } catch (e) { }
      this.activeSourceNode = null;
    }
    if (this.activeAudioElement) {
      try { this.activeAudioElement.pause(); } catch (e) { }
      this.activeAudioElement = null;
    }
    if (this.activeAudioUrl) {
      URL.revokeObjectURL(this.activeAudioUrl);
      this.activeAudioUrl = null;
    }
  }

  /** Start Canvas Visualizer */
  startVisualizer() {
    if (this.visualizer) {
      this.visualizer.start(() => {
        const data = this.engine.getAnalyserData();
        if (data) {
          this.ui.setVUMeter(data.db);
        }
        return data;
      });
    }
  }

  /** Stop Canvas Visualizer */
  stopVisualizer() {
    if (this.visualizer) {
      this.visualizer.stop();
    }
    this.ui.setVUMeter(-100);
  }
}

// Instantiate App on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  new LoopApp();
});
