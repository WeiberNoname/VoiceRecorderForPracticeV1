/**
 * Local Whisper WASM/ONNX Speech-To-Text Engine
 * Runs 100% locally in-memory via @xenova/transformers
 */
import { pipeline, env } from '@xenova/transformers';

// Configure transformers env for optimal browser/electron WASM execution
env.allowLocalModels = false;
env.useBrowserCache = true;

export class LocalWhisperEngine {
  constructor() {
    this.transcriber = null;
    this.isLoading = false;
    this.onProgressCallback = null;
  }

  /** Initialize or return existing Whisper pipeline */
  async initPipeline(onProgress) {
    if (this.transcriber) return this.transcriber;
    if (this.isLoading) return null;

    this.isLoading = true;
    try {
      this.transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        progress_callback: (p) => {
          if (onProgress) onProgress(p);
          if (this.onProgressCallback) this.onProgressCallback(p);
        }
      });
      this.isLoading = false;
      return this.transcriber;
    } catch (err) {
      console.warn('Local Whisper pipeline init warning:', err);
      this.isLoading = false;
      return null;
    }
  }

  /** Transcribe audio Blob into English text 100% locally */
  async transcribeAudioBlob(blob, onProgress) {
    if (!blob || blob.size < 100) return null;

    try {
      const transcriber = await this.initPipeline(onProgress);
      if (!transcriber) return null;

      // Extract 16kHz mono Float32 PCM samples from Blob
      const pcmFloat32 = await this.blobTo16kPCMFloat32(blob);
      if (!pcmFloat32 || pcmFloat32.length === 0) return null;

      const output = await transcriber(pcmFloat32, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: 'english',
        task: 'transcribe'
      });

      if (output && output.text) {
        return output.text.trim();
      }
    } catch (err) {
      console.error('Local Whisper WASM transcription error:', err);
    }
    return null;
  }

  /** Resample audio Blob to 16kHz mono Float32Array */
  async blobTo16kPCMFloat32(blob) {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const offlineCtx = new OfflineCtxClass(
        1,
        Math.ceil(audioBuffer.duration * 16000),
        16000
      );

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      return renderedBuffer.getChannelData(0);
    } catch (err) {
      console.warn('PCM extraction warning:', err);
      return null;
    }
  }
}
