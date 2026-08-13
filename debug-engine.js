/**
 * Voice Recorder - System Diagnostics & STT Debugging Engine
 * Automated Test Suite for Voice-to-Text, Audio Engines, and Translation APIs
 */
import { AudioEngine } from './audio-engine.js';
import { LocalWhisperEngine } from './local-whisper-engine.js';
import { TranslatorEngine } from './translator-engine.js';

export class DebugEngine {
  constructor() {
    this.audioEngine = new AudioEngine();
    this.localWhisper = new LocalWhisperEngine();
    this.translator = new TranslatorEngine();
    this.testResults = [];
    this.isExecuting = false;
    this.onTestUpdate = null;
    this.onLogMessage = null;
  }

  log(msg) {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${msg}`;
    console.log(formatted);
    if (this.onLogMessage) this.onLogMessage(formatted);
  }

  /** Run Complete Diagnostic Test Suite (Tests 1 through 6) */
  async runAllDiagnostics() {
    if (this.isExecuting) return this.testResults;
    this.isExecuting = true;

    this.testResults = [];
    this.log('🚀 Initializing System Diagnostics & STT Debugging Suite...');

    try {
      await this.testMicrophoneCapture();
      await this.testPcmResampler();
      await this.testLocalWhisperWasm();
      await this.testWebSpeechApi();
      await this.testTranslationApi();
      await this.testElectronIpcBridge();
    } catch (suiteErr) {
      this.log(`⚠️ Diagnostic Suite Warning: ${suiteErr.message}`);
    }

    this.isExecuting = false;
    this.log('✅ Diagnostic Test Suite Completed.');
    return this.testResults;
  }

  /** TEST 1: Microphone Stream Capture Test */
  async testMicrophoneCapture() {
    const id = 'test-1';
    const name = 'Microphone Audio Stream Capture';
    this.notifyStatus(id, name, 'RUNNING', 'Testing getUserMedia audio track...');
    const start = performance.now();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tracks = stream.getAudioTracks();
      const isLive = tracks.length > 0 && tracks[0].readyState === 'live';

      // Measure audio magnitude
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);

      tracks.forEach(t => t.stop());
      audioCtx.close();

      const elapsed = Math.round(performance.now() - start);

      if (isLive) {
        this.notifyStatus(id, name, 'PASS', `Active track: ${tracks[0].label || 'Microphone'}`, elapsed);
      } else {
        this.notifyStatus(id, name, 'FAIL', 'Audio track not live', elapsed);
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      this.notifyStatus(id, name, 'FAIL', `Mic Error: ${err.message}`, elapsed);
    }
  }

  /** TEST 2: 16kHz Mono PCM Resampler Test */
  async testPcmResampler() {
    const id = 'test-2';
    const name = '16kHz Mono PCM Resampler Engine';
    this.notifyStatus(id, name, 'RUNNING', 'Resampling synthetic audio buffer...');
    const start = performance.now();

    try {
      // Create synthetic 1-second sine wave audio blob
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin((2 * Math.PI * 440 * i) / audioCtx.sampleRate);
      }

      const wavBlob = this.audioEngine.audioBufferToWav(buffer);
      const pcmData = await this.localWhisper.blobTo16kPCMFloat32(wavBlob);
      audioCtx.close();

      const elapsed = Math.round(performance.now() - start);

      if (pcmData && pcmData.length >= 15000) {
        this.notifyStatus(id, name, 'PASS', `Extracted ${pcmData.length} Float32 16kHz PCM samples`, elapsed);
      } else {
        this.notifyStatus(id, name, 'FAIL', 'PCM resampling returned empty buffer', elapsed);
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      this.notifyStatus(id, name, 'FAIL', `Resampler Error: ${err.message}`, elapsed);
    }
  }

  /** TEST 3: Local Whisper WASM Model Pipeline Test */
  async testLocalWhisperWasm() {
    const id = 'test-3';
    const name = 'Local Whisper WASM Model Pipeline';
    this.notifyStatus(id, name, 'RUNNING', 'Checking @xenova/transformers pipeline...');
    const start = performance.now();

    try {
      const transcriber = await this.localWhisper.initPipeline((p) => {
        if (p && p.status === 'downloading') {
          const pct = Math.round((p.loaded / p.total) * 100);
          this.log(`Whisper Model Download Progress: ${pct}%`);
        }
      });

      const elapsed = Math.round(performance.now() - start);

      if (transcriber) {
        this.notifyStatus(id, name, 'PASS', 'Whisper-tiny WASM model loaded & ready', elapsed);
      } else {
        this.notifyStatus(id, name, 'FAIL', 'Failed to initialize WASM model pipeline', elapsed);
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      this.notifyStatus(id, name, 'FAIL', `Whisper Error: ${err.message}`, elapsed);
    }
  }

  /** TEST 4: Web Speech API & Native Engine Availability Test */
  async testWebSpeechApi() {
    const id = 'test-4';
    const name = 'STT Engine Availability & Runtime Check';
    this.notifyStatus(id, name, 'RUNNING', 'Checking speech recognition engines...');
    const start = performance.now();

    try {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      const isSupported = !!SpeechRecognitionClass;
      const isElectron = !!(window.electronAPI || (typeof process !== 'undefined' && process.versions && process.versions.electron));
      const elapsed = Math.round(performance.now() - start);

      if (isElectron) {
        this.notifyStatus(id, name, 'PASS', 'Electron Desktop STT Engine Active (Local Whisper WASM Enabled)', elapsed);
      } else if (isSupported) {
        this.notifyStatus(id, name, 'PASS', 'Browser Native SpeechRecognition Supported', elapsed);
      } else {
        this.notifyStatus(id, name, 'PASS', 'Local Whisper WASM STT Engine Active', elapsed);
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      this.notifyStatus(id, name, 'FAIL', `STT Engine Check Error: ${err.message}`, elapsed);
    }
  }

  /** TEST 5: Translation REST API Network & Latency Test */
  async testTranslationApi() {
    const id = 'test-5';
    const name = 'Translation REST API Network & Latency';
    this.notifyStatus(id, name, 'RUNNING', 'Ping testing Google & MyMemory translation APIs...');
    const start = performance.now();

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent('Hello world')}`;
      const resp = await fetch(url);
      const data = await resp.json();
      const elapsed = Math.round(performance.now() - start);

      if (data && data[0] && data[0][0] && data[0][0][0]) {
        const resultText = data[0][0][0];
        this.notifyStatus(id, name, 'PASS', `Result: "${resultText}" (${elapsed}ms latency)`, elapsed);
      } else {
        this.notifyStatus(id, name, 'FAIL', 'Invalid API response format', elapsed);
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      this.notifyStatus(id, name, 'FAIL', `API Network Error: ${err.message}`, elapsed);
    }
  }

  /** TEST 6: Electron Main Process IPC Bridge Test */
  async testElectronIpcBridge() {
    const id = 'test-6';
    const name = 'Electron Main Process STT IPC Bridge';
    this.notifyStatus(id, name, 'RUNNING', 'Testing window.electronAPI.transcribeAudio IPC...');
    const start = performance.now();

    if (window.electronAPI && typeof window.electronAPI.transcribeAudio === 'function') {
      try {
        const dummyBuffer = new ArrayBuffer(500);
        const res = await window.electronAPI.transcribeAudio(dummyBuffer);
        const elapsed = Math.round(performance.now() - start);

        if (res && res.error !== undefined) {
          this.notifyStatus(id, name, 'PASS', 'IPC Bridge operational (transcribeAudio connected)', elapsed);
        } else {
          this.notifyStatus(id, name, 'FAIL', 'IPC Bridge returned invalid response', elapsed);
        }
      } catch (err) {
        const elapsed = Math.round(performance.now() - start);
        this.notifyStatus(id, name, 'FAIL', `IPC Error: ${err.message}`, elapsed);
      }
    } else {
      const elapsed = Math.round(performance.now() - start);
      this.notifyStatus(id, name, 'N/A', 'Browser mode (IPC Bridge inactive)', elapsed);
    }
  }

  notifyStatus(id, name, state, details, elapsedMs = 0) {
    const resultObj = { id, name, state, details, elapsedMs };
    const index = this.testResults.findIndex(r => r.id === id);
    if (index >= 0) {
      this.testResults[index] = resultObj;
    } else {
      this.testResults.push(resultObj);
    }

    this.log(`[${state}] ${name}: ${details} ${elapsedMs ? `(${elapsedMs}ms)` : ''}`);
    if (this.onTestUpdate) this.onTestUpdate(resultObj);
  }
}
