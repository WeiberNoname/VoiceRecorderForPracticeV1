/**
 * Voice Recorder - Ping-Pong Loop Studio Controller
 * Modern, Maintainable, Modular Architecture
 */
import { AudioEngine } from './audio-engine.js';
import { Visualizer } from './visualizer.js';

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
      loopBtnIcon: document.getElementById('loop-btn-icon')
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

  /** Reset Timer to 00:00:00.00 */
  resetTimerDisplay() {
    this.setTimerDisplay(0);
  }

  /** GPU-Accelerated VU Level Meter Update */
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
}

/**
 * Main Ping-Pong Loop Application Orchestrator
 */
class LoopApp {
  constructor() {
    this.engine = new AudioEngine();
    this.visualizer = null;
    this.ui = new UIView();

    // Loop Application State
    this.phase = LOOP_PHASE.IDLE;
    this.loopDurationMs = CONFIG.DEFAULT_DURATION_MS;

    // Handles & Resources
    this.phaseTimeout = null;
    this.countdownInterval = null;
    this.activeAudioElement = null;
    this.activeAudioUrl = null;

    this.init();
  }

  async init() {
    this.setupElectronTitlebar();
    this.setupVisualizer();
    this.bindEvents();
    await this.loadAudioDevices();

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

  /** Audio Devices Enumeration */
  async loadAudioDevices() {
    const select = this.ui.elements.micSelect;
    if (!select) return;

    const currentVal = select.value || 'system_audio';
    const devices = await this.engine.getAudioInputs();

    select.innerHTML = '';

    const sysOpt = document.createElement('option');
    sysOpt.value = 'system_audio';
    sysOpt.textContent = '💻 Computer System Audio (PC Sound / YouTube)';
    select.appendChild(sysOpt);

    const defaultOpt = document.createElement('option');
    defaultOpt.value = 'default_mic';
    defaultOpt.textContent = '🎙️ Default Microphone (Your Voice)';
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

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.toggleLoop();
      } else if (e.code === 'Escape') {
        if (this.phase !== LOOP_PHASE.IDLE) {
          e.preventDefault();
          this.stopLoop();
        }
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
  }

  /** Main Toggle Controller */
  async toggleLoop() {
    if (this.phase === LOOP_PHASE.IDLE) {
      await this.startLoop();
    } else {
      await this.stopLoop();
    }
  }

  /** Start Ping-Pong Loop */
  async startLoop() {
    this.ui.setControlsDisabled(true);
    this.ui.setLoopButtonState(true);
    await this.enterRecordPhase();
  }

  /** Step 1: Record Phase Execution */
  async enterRecordPhase() {
    if (this.phase === LOOP_PHASE.IDLE && this.ui.elements.btnToggleLoop.getAttribute('data-active') === 'false') {
      return;
    }

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
        if (this.phase !== LOOP_PHASE.RECORDING) return;

        this.stopVisualizer();
        this.stopCountdown();

        const result = await this.engine.stopRecording(false);

        if (result && result.blob && this.phase === LOOP_PHASE.RECORDING) {
          await this.enterPlayPhase(result.blob);
        } else if (this.phase === LOOP_PHASE.RECORDING) {
          await this.enterRecordPhase();
        }
      }, this.loopDurationMs);

    } catch (err) {
      console.error('Ping-Pong loop recording failed:', err);
      alert('Could not start loop recording. Please check microphone and sound permissions.');
      await this.stopLoop();
    }
  }

  /** Step 2: Play Phase Execution */
  async enterPlayPhase(blob) {
    if (this.phase === LOOP_PHASE.IDLE || !blob) return;

    this.phase = LOOP_PHASE.PLAYING;
    const durationSec = Math.round(this.loopDurationMs / 1000);
    this.ui.setStatus(`🔊 Loop Playing (${durationSec}s)`, 'paused');
    this.startCountdown(this.loopDurationMs, `🔊 Play ${durationSec}s`);

    this.cleanupAudioResources();

    try {
      // Decode blob to AudioBuffer and play via Web Audio so AnalyserNode receives live magnitude
      const audioBuffer = await this.engine.blobToAudioBuffer(blob);
      if (this.phase !== LOOP_PHASE.PLAYING) return;

      const sourceNode = this.engine.audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;

      // Connect playing source to speaker destination AND to analyserNode for live visualizer waveform
      sourceNode.connect(this.engine.audioCtx.destination);
      if (this.engine.analyserNode) {
        try { sourceNode.connect(this.engine.analyserNode); } catch (e) {}
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
      } catch (e) {}
    }

    this.phaseTimeout = setTimeout(async () => {
      if (this.phase !== LOOP_PHASE.PLAYING) return;

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
    this.ui.resetTimerDisplay();
    this.ui.setStatus('Ready', 'ready');
    this.ui.setLoopButtonState(false);
    this.ui.setControlsDisabled(false);
  }

  /** Clean Up Audio Playback Resources & Prevent URL/Node Leaks */
  cleanupAudioResources() {
    if (this.activeSourceNode) {
      try { this.activeSourceNode.stop(); } catch (e) {}
      try { this.activeSourceNode.disconnect(); } catch (e) {}
      this.activeSourceNode = null;
    }
    if (this.activeAudioElement) {
      try { this.activeAudioElement.pause(); } catch (e) {}
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
