/**
 * Voice Recorder - Audio Engine (Web Audio API, MediaRecorder & System Audio Loopback)
 */
export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.micStream = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.analyserNode = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.isPaused = false;
    this.recordingStartTime = 0;
    this.pausedDuration = 0;
    this.pauseStartTime = 0;
  }

  /** Initialize Web Audio Context */
  async initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  /** Enumerate available audio input devices (Microphones) */
  async getAudioInputs() {
    try {
      let devices = [];
      try {
        const initialStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        initialStream.getTracks().forEach(track => track.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch (e) {
        console.warn('No microphone found or permission declined, fallback to system audio:', e);
      }
      return devices.filter(d => d.kind === 'audioinput' && d.deviceId);
    } catch (err) {
      return [];
    }
  }

  /** Capture Internal Computer System Audio (PC Sound / WASAPI Loopback) */
  async getSystemAudio() {
    const constraints = {
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      }
    };

    const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      stream.getTracks().forEach(t => t.stop());
      throw new Error('No system audio track captured. Please make sure system audio sharing is enabled.');
    }

    // Stop video track since we only record sound
    stream.getVideoTracks().forEach(t => t.stop());

    audioTrack.onended = () => {
      if (this.isRecording) {
        this.stopRecording();
      }
    };

    return new MediaStream([audioTrack]);
  }

  /** Start recording session (supports system_audio, default_mic, or microphone deviceId) */
  async startRecording(deviceId = 'default_mic', reuseStream = false) {
    await this.initContext();

    let stream = null;

    if (reuseStream && this.micStream && this.micStream.active && this.micStream.getAudioTracks().some(t => t.readyState === 'live')) {
      stream = this.micStream;
    } else {
      if (deviceId === 'system_audio') {
        stream = await this.getSystemAudio();
      } else {
        // Physical Microphone capture constraint pipeline
        const constraintsList = [];

        if (deviceId && deviceId !== 'default_mic' && deviceId !== 'system_audio') {
          constraintsList.push({
            audio: {
              deviceId: { exact: deviceId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          constraintsList.push({
            audio: { deviceId: deviceId }
          });
        }

        constraintsList.push({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        constraintsList.push({ audio: true });

        let lastErr = null;
        for (const constraints of constraintsList) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (stream && stream.getAudioTracks().length > 0 && stream.getAudioTracks().some(t => t.readyState === 'live')) {
              break;
            }
          } catch (err) {
            lastErr = err;
          }
        }

        if (!stream) {
          console.error('Microphone capture attempts failed:', lastErr);
          throw new Error('Microphone access failed. Please ensure your microphone is plugged in and allowed in Windows Privacy Settings.');
        }
      }
    }

    this.micStream = stream;

    // Setup Web Audio Nodes for Visualizer & VU Meter
    try {
      if (this.sourceNode) {
        try { this.sourceNode.disconnect(); } catch (e) {}
      }
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.micStream);
      if (!this.gainNode) {
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.value = 1.0;
      }
      if (!this.analyserNode) {
        this.analyserNode = this.audioCtx.createAnalyser();
        this.analyserNode.fftSize = 1024;
        this.analyserNode.smoothingTimeConstant = 0.8;
      }

      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.analyserNode);
    } catch (nodeErr) {
      console.warn('Web Audio node setup warning:', nodeErr);
    }

    // Determine supported MIME type for MediaRecorder
    let mimeType = '';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ];

    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        mimeType = t;
        break;
      }
    }

    const options = mimeType ? { mimeType } : {};

    this.mediaRecorder = new MediaRecorder(this.micStream, options);
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.audioChunks.push(e.data);
      }
    };

    this.mediaRecorder.start(100);
    this.isRecording = true;
    this.isPaused = false;
    this.recordingStartTime = Date.now();
    this.pausedDuration = 0;
  }

  /** Pause recording */
  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPaused = true;
      this.pauseStartTime = Date.now();
    }
  }

  /** Resume recording */
  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPaused = false;
      this.pausedDuration += (Date.now() - this.pauseStartTime);
    }
  }

  /** Stop recording and return final audio Blob */
  stopRecording(stopStreamOnFinish = true) {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });

        if (stopStreamOnFinish && this.micStream) {
          this.micStream.getTracks().forEach(track => track.stop());
          this.micStream = null;
        }

        this.isRecording = false;
        this.isPaused = false;
        resolve({ blob, mimeType });
      };

      try {
        if (this.mediaRecorder.state === 'recording' || this.mediaRecorder.state === 'paused') {
          this.mediaRecorder.requestData();
        }
      } catch (e) {
        console.warn('requestData warning:', e);
      }

      this.mediaRecorder.stop();
    });
  }

  /**
   * Record raw PCM samples directly into Web Audio AudioBuffer (5000ms)
   * Resolves with { audioBuffer, wavBlob }
   */
  async recordPcmBuffer(durationMs = 5000, deviceId = 'system_audio') {
    await this.startRecording(deviceId, false);

    return new Promise((resolve) => {
      const sampleRate = this.audioCtx.sampleRate;
      const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
      const pcmData = new Float32Array(totalSamples);
      let recordedCount = 0;

      const scriptNode = this.audioCtx.createScriptProcessor(4096, 1, 1);

      scriptNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputBuffer = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < inputBuffer.length; i++) {
          if (recordedCount < totalSamples) {
            pcmData[recordedCount++] = inputBuffer[i];
          }
        }
      };

      if (this.sourceNode) {
        this.sourceNode.connect(scriptNode);
        scriptNode.connect(this.audioCtx.destination);
      }

      setTimeout(async () => {
        if (scriptNode) {
          try { scriptNode.disconnect(); } catch (err) {}
          scriptNode.onaudioprocess = null;
        }

        await this.stopRecording(true);

        const validCount = Math.max(1, recordedCount);
        const audioBuffer = this.audioCtx.createBuffer(1, validCount, sampleRate);
        audioBuffer.getChannelData(0).set(pcmData.subarray(0, validCount));

        const wavBlob = this.audioBufferToWav(audioBuffer);
        resolve({ audioBuffer, wavBlob });
      }, durationMs);
    });
  }

  /** Get live analyser data for visualizer and VU meter */
  getAnalyserData() {
    if (!this.analyserNode) return null;
    const bufferLength = this.analyserNode.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    this.analyserNode.getByteFrequencyData(freqData);
    this.analyserNode.getByteTimeDomainData(timeData);

    // Calculate RMS decibels
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const floatVal = (timeData[i] - 128) / 128;
      sum += floatVal * floatVal;
    }
    const rms = Math.sqrt(sum / bufferLength);
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;

    return { freqData, timeData, db, rms };
  }

  /** Convert audio Blob to AudioBuffer */
  async blobToAudioBuffer(blob) {
    await this.initContext();
    const arrayBuffer = await blob.arrayBuffer();
    try {
      return await this.audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.warn('decodeAudioData fallback attempt:', e);
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio();
        audio.src = url;
        audio.oncanplaythrough = async () => {
          try {
            const resp = await fetch(url);
            const buf = await resp.arrayBuffer();
            const decoded = await this.audioCtx.decodeAudioData(buf);
            URL.revokeObjectURL(url);
            resolve(decoded);
          } catch (fetchErr) {
            URL.revokeObjectURL(url);
            reject(fetchErr);
          }
        };
        audio.onerror = (err) => {
          URL.revokeObjectURL(url);
          reject(err);
        };
      });
    }
  }

  /** Convert AudioBuffer to WAV Blob */
  audioBufferToWav(audioBuffer) {
    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let sampleRate = audioBuffer.sampleRate;
    let offset = 0;
    let pos = 0;

    function writeString(str) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(pos++, str.charCodeAt(i));
      }
    }

    function setUint16(data) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data) {
      view.setUint32(pos, data, true);
      pos += 4;
    }

    // WAV Header
    writeString('RIFF');
    setUint32(length - 8);
    writeString('WAVE');
    writeString('fmt ');
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    writeString('data');
    setUint32(length - pos - 4);

    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    while (offset < audioBuffer.length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }
}
