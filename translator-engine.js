/**
 * Voice Recorder - English Voice Translator Engine
 * Option 1 Implementation: Local WASM/ONNX Whisper Engine (@xenova/transformers) + Translation + TTS
 */
import { AudioEngine } from './audio-engine.js';
import { LocalWhisperEngine } from './local-whisper-engine.js';

export const SUPPORTED_LANGUAGES = [
  { code: 'es', name: 'Spanish 🇪🇸', voiceCode: 'es-ES' },
  { code: 'fr', name: 'French 🇫🇷', voiceCode: 'fr-FR' },
  { code: 'de', name: 'German 🇩🇪', voiceCode: 'de-DE' },
  { code: 'zh-CN', name: 'Chinese (Mandarin) 🇨🇳', voiceCode: 'zh-CN' },
  { code: 'ja', name: 'Japanese 🇯🇵', voiceCode: 'ja-JP' },
  { code: 'ko', name: 'Korean 🇰🇷', voiceCode: 'ko-KR' },
  { code: 'it', name: 'Italian 🇮🇹', voiceCode: 'it-IT' },
  { code: 'pt', name: 'Portuguese 🇵🇹', voiceCode: 'pt-PT' },
  { code: 'ru', name: 'Russian 🇷🇺', voiceCode: 'ru-RU' },
  { code: 'hi', name: 'Hindi 🇮🇳', voiceCode: 'hi-IN' },
  { code: 'ar', name: 'Arabic 🇸🇦', voiceCode: 'ar-SA' },
  { code: 'nl', name: 'Dutch 🇳🇱', voiceCode: 'nl-NL' }
];

export class TranslatorEngine {
  constructor() {
    this.audioEngine = new AudioEngine();
    this.localWhisper = new LocalWhisperEngine();
    this.recognition = null;
    this.audioCtx = null;
    this.activeStream = null;
    this.isListening = false;
    this.isRecordingAudio = false;
    this.singleMediaRecorder = null;
    this.audioChunks = [];
    this.useMediaRecorderFallback = false;
    this.targetLang = 'es';
    this.transcript = '';
    this.translation = '';

    // Callbacks
    this.onTranscriptUpdate = null;
    this.onTranslationUpdate = null;
    this.onAudioMagnitudeUpdate = null;
    this.onStatusChange = null;
    this.onError = null;

    this.initSpeechRecognition();
  }

  /** Initialize Web Speech API Recognition */
  initSpeechRecognition() {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

    const isElectron = !!(window.electronAPI || (typeof process !== 'undefined' && process.versions && process.versions.electron));
    if (isElectron) {
      this.useMediaRecorderFallback = true;
    }

    if (!SpeechRecognitionClass) {
      this.useMediaRecorderFallback = true;
      return;
    }

    try {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        if (this.onStatusChange) this.onStatusChange('listening', '🔴 Listening for English voice...');
      };

      this.recognition.onresult = async (event) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i] && event.results[i][0] && event.results[i][0].transcript) {
            fullTranscript += event.results[i][0].transcript;
          }
        }

        if (fullTranscript.trim()) {
          this.transcript = fullTranscript.trim();
          if (this.onTranscriptUpdate) this.onTranscriptUpdate(this.transcript);

          // Perform real-time translation
          await this.translateCurrentText(this.transcript);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('SpeechRecognition error event:', event.error);
        if (event.error === 'network' || event.error === 'not-allowed') {
          this.useMediaRecorderFallback = true;
          if (this.isListening) {
            this.stopSpeechRecognition();
            this.startMediaRecorderSTT();
          }
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          if (this.onStatusChange) this.onStatusChange('error', `⚠️ Speech Error: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening && !this.useMediaRecorderFallback) {
          try {
            this.recognition.start();
          } catch (e) {
            this.isListening = false;
            if (this.onStatusChange) this.onStatusChange('idle', 'Ready');
          }
        } else if (!this.useMediaRecorderFallback) {
          if (this.onStatusChange) this.onStatusChange('idle', 'Ready');
        }
      };
    } catch (err) {
      console.warn('SpeechRecognition init failed, defaulting to MediaRecorder fallback:', err);
      this.useMediaRecorderFallback = true;
    }
  }

  /** Setup Web Audio Analyser for Live Magnitude Level Meter */
  setupAudioAnalyser(stream) {
    if (!stream) return;
    this.activeStream = stream;

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) this.audioCtx = new AudioCtxClass();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const sourceNode = this.audioCtx.createMediaStreamSource(stream);
      const analyserNode = this.audioCtx.createAnalyser();
      analyserNode.fftSize = 512;
      analyserNode.smoothingTimeConstant = 0.8;
      sourceNode.connect(analyserNode);

      const bufferLength = analyserNode.frequencyBinCount;
      const timeData = new Uint8Array(bufferLength);

      const checkMagnitude = () => {
        if (!this.isListening && !this.isRecordingAudio) {
          if (this.onAudioMagnitudeUpdate) this.onAudioMagnitudeUpdate(-100, 0);
          return;
        }

        analyserNode.getByteTimeDomainData(timeData);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const floatVal = (timeData[i] - 128) / 128;
          sum += floatVal * floatVal;
        }
        const rms = Math.sqrt(sum / bufferLength);
        const db = rms > 0 ? 20 * Math.log10(rms) : -100;

        if (this.onAudioMagnitudeUpdate) {
          this.onAudioMagnitudeUpdate(db, rms);
        }

        requestAnimationFrame(checkMagnitude);
      };

      checkMagnitude();
    } catch (e) {
      console.warn('Audio magnitude meter setup warning:', e);
    }
  }

  /** Set Target Translation Language */
  setTargetLanguage(langCode) {
    this.targetLang = langCode;
    if (this.transcript) {
      this.translateCurrentText(this.transcript);
    }
  }

  /** Start English Listening Session (Continuous mode) */
  startListening() {
    this.isListening = true;

    if (this.useMediaRecorderFallback || !this.recognition) {
      this.startMediaRecorderSTT();
    } else {
      try {
        this.recognition.start();
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          this.setupAudioAnalyser(stream);
        }).catch(() => { });
      } catch (err) {
        if (err.name === 'InvalidStateError') {
          if (this.onStatusChange) this.onStatusChange('listening', '🔴 Listening for English voice...');
        } else {
          this.startMediaRecorderSTT();
        }
      }
    }
  }

  /** Stop English Listening Session */
  stopListening() {
    this.isListening = false;
    this.stopSpeechRecognition();
    this.isRecordingAudio = false;
    if (this.activeStream) {
      this.activeStream.getTracks().forEach(t => t.stop());
      this.activeStream = null;
    }
    if (this.onAudioMagnitudeUpdate) this.onAudioMagnitudeUpdate(-100, 0);
    if (this.onStatusChange) this.onStatusChange('idle', 'Ready');
  }

  stopSpeechRecognition() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) { }
    }
  }

  /** Start Single Voice Recording Session */
  async startSingleRecording() {
    if (this.isRecordingAudio) return;
    this.isRecordingAudio = true;
    this.audioChunks = [];

    if (this.onStatusChange) this.onStatusChange('listening', '🔴 Recording English voice clip...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.activeStream = stream;
      this.setupAudioAnalyser(stream);

      this.singleMediaRecorder = new MediaRecorder(stream);

      this.singleMediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.singleMediaRecorder.onstop = async () => {
        if (this.activeStream) {
          this.activeStream.getTracks().forEach(track => track.stop());
          this.activeStream = null;
        }

        const rawBlob = new Blob(this.audioChunks, { type: this.singleMediaRecorder.mimeType || 'audio/webm' });

        if (rawBlob.size > 0) {
          if (this.onStatusChange) this.onStatusChange('translating', '⚡ Transcribing local voice...');
          await this.transcribeAudioBlob(rawBlob);
        }

        this.isRecordingAudio = false;
        if (this.onAudioMagnitudeUpdate) this.onAudioMagnitudeUpdate(-100, 0);
        if (this.onStatusChange) this.onStatusChange('idle', 'Ready');
      };

      this.singleMediaRecorder.start();
    } catch (err) {
      console.error('Single voice recording failed:', err);
      this.isRecordingAudio = false;
      if (this.onAudioMagnitudeUpdate) this.onAudioMagnitudeUpdate(-100, 0);
      if (this.onStatusChange) this.onStatusChange('error', '⚠️ Microphone access permission required');
    }
  }

  /** Stop Single Voice Recording Session & Trigger Instant Translation */
  stopSingleRecording() {
    if (this.singleMediaRecorder && this.singleMediaRecorder.state === 'recording') {
      this.singleMediaRecorder.stop();
    } else {
      this.isRecordingAudio = false;
      if (this.onStatusChange) this.onStatusChange('idle', 'Ready');
    }
  }

  /** MediaRecorder Audio Chunk STT Engine (Continuous mode) */
  async startMediaRecorderSTT(durationMs = 4000) {
    if (this.isRecordingAudio || !this.isListening) return;
    this.isRecordingAudio = true;

    if (this.onStatusChange) this.onStatusChange('listening', '🔴 Listening for English voice...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.setupAudioAnalyser(stream);

      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const rawBlob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });

        if (rawBlob.size > 0 && this.isListening) {
          if (this.onStatusChange) this.onStatusChange('translating', '⚡ Transcribing local voice...');
          await this.transcribeAudioBlob(rawBlob);
        }

        this.isRecordingAudio = false;

        if (this.isListening) {
          setTimeout(() => this.startMediaRecorderSTT(durationMs), 300);
        } else {
          if (this.onStatusChange) this.onStatusChange('idle', 'Ready');
        }
      };

      mediaRecorder.start();

      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, durationMs);

    } catch (err) {
      console.error('MediaRecorder STT capture failed:', err);
      this.isRecordingAudio = false;
      this.isListening = false;
      if (this.onAudioMagnitudeUpdate) this.onAudioMagnitudeUpdate(-100, 0);
      if (this.onStatusChange) this.onStatusChange('error', '⚠️ Microphone access permission required');
    }
  }

  /** Transcribe Audio Blob into English Text (Option 1 Implementation) */
  async transcribeAudioBlob(blob) {
    if (!blob || blob.size < 100) return;

    // Step 1: Execute Local Whisper WASM Engine (@xenova/transformers)
    try {
      const localText = await this.localWhisper.transcribeAudioBlob(blob, (progress) => {
        if (progress && progress.status === 'downloading' && this.onStatusChange) {
          const pct = Math.round((progress.loaded / progress.total) * 100);
          this.onStatusChange('translating', `⚡ Loading Whisper Model ${pct}%...`);
        }
      });

      if (localText && localText.trim()) {
        const cleanText = localText.trim();
        if (cleanText.length > 1 && !cleanText.toLowerCase().includes('subtitles by')) {
          this.transcript = cleanText;
          if (this.onTranscriptUpdate) this.onTranscriptUpdate(this.transcript);
          await this.translateCurrentText(this.transcript);
          return;
        }
      }
    } catch (localErr) {
      console.warn('Local Whisper WASM engine warning:', localErr);
    }

    // Step 2: Fallback to Electron IPC STT engine if needed
    try {
      const wavBlob = await this.audioEngine.blobTo16kWav(blob);
      const wavArrayBuffer = await wavBlob.arrayBuffer();

      if (window.electronAPI && typeof window.electronAPI.transcribeAudio === 'function') {
        const ipcResult = await window.electronAPI.transcribeAudio(wavArrayBuffer);
        if (ipcResult && ipcResult.success && ipcResult.text && ipcResult.text.trim()) {
          const cleanText = ipcResult.text.trim();
          if (cleanText.length > 1 && !cleanText.toLowerCase().includes('subtitles by')) {
            this.transcript = cleanText;
            if (this.onTranscriptUpdate) this.onTranscriptUpdate(this.transcript);
            await this.translateCurrentText(this.transcript);
            return;
          }
        }
      }
    } catch (ipcErr) {
      console.warn('IPC transcription warning:', ipcErr);
    }

    if (this.onStatusChange && this.isListening) {
      this.onStatusChange('listening', '🔴 Listening for English voice...');
    }
  }

  /** Translate English text into target language */
  async translateCurrentText(text) {
    if (!text || !text.trim()) {
      this.translation = '';
      if (this.onTranslationUpdate) this.onTranslationUpdate('');
      return;
    }

    if (this.onStatusChange && (this.isListening || this.isRecordingAudio)) {
      this.onStatusChange('translating', '⚡ Translating...');
    }

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(this.targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Primary translate API failed');
      const data = await response.json();

      let translatedText = '';
      if (data && data[0]) {
        translatedText = data[0].map(segment => segment[0]).join('');
      }

      this.translation = translatedText || text;
      if (this.onTranslationUpdate) this.onTranslationUpdate(this.translation);

      if (this.onStatusChange && this.isListening) {
        this.onStatusChange('listening', '🔴 Listening for English voice...');
      } else if (this.onStatusChange && !this.isListening && !this.isRecordingAudio) {
        this.onStatusChange('idle', 'Ready');
      }
    } catch (err) {
      console.warn('Primary translation API failed, fallback to MyMemory API:', err);
      try {
        const fallbackUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(this.targetLang)}`;
        const fbResponse = await fetch(fallbackUrl);
        const fbData = await fbResponse.json();
        if (fbData && fbData.responseData && fbData.responseData.translatedText) {
          this.translation = fbData.responseData.translatedText;
          if (this.onTranslationUpdate) this.onTranslationUpdate(this.translation);
        } else {
          this.translation = text;
          if (this.onTranslationUpdate) this.onTranslationUpdate(this.translation);
        }
      } catch (fbErr) {
        console.error('Translation network failed:', fbErr);
        this.translation = text;
        if (this.onTranslationUpdate) this.onTranslationUpdate(this.translation);
        if (this.onStatusChange) this.onStatusChange('error', '⚠️ Network offline (Displaying original text)');
        return;
      }

      if (this.onStatusChange && this.isListening) {
        this.onStatusChange('listening', '🔴 Listening for English voice...');
      } else if (this.onStatusChange && !this.isListening && !this.isRecordingAudio) {
        this.onStatusChange('idle', 'Ready');
      }
    }
  }

  /** Speak Translated Text via Text-to-Speech (TTS) */
  speakTranslation() {
    if (!this.translation || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(this.translation);

    const targetObj = SUPPORTED_LANGUAGES.find(l => l.code === this.targetLang);
    if (targetObj) {
      utterance.lang = targetObj.voiceCode || targetObj.code;
    } else {
      utterance.lang = this.targetLang;
    }

    window.speechSynthesis.speak(utterance);
  }

  /** Reset transcript & translation */
  clear() {
    this.transcript = '';
    this.translation = '';
    if (this.onTranscriptUpdate) this.onTranscriptUpdate('');
    if (this.onTranslationUpdate) this.onTranslationUpdate('');
  }
}
