/**
 * Voice Recorder - Waveform Canvas Visualizer Engine
 */
export class Visualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.animId = null;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
  }

  start(analyserDataCallback) {
    this.stop();

    const render = () => {
      const data = analyserDataCallback();
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      if (data && data.timeData) {
        this.drawWaveform(data.timeData);
      } else {
        this.drawIdleState();
      }

      this.animId = requestAnimationFrame(render);
    };

    render();
  }

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.drawIdleState();
  }

  drawIdleState() {
    if (!this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    // Draw center subtle line
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(0, h / 2);
    this.ctx.lineTo(w, h / 2);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([6, 6]);
    this.ctx.stroke();
    this.ctx.restore();
  }

  /** Waveform Oscilloscope */
  drawWaveform(timeData) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    // Batched grid lines (high efficiency, 1 stroke call)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y < h; y += 40) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.restore();

    // Waveform line (no GPU blur filter overhead)
    ctx.save();
    ctx.beginPath();
    const sliceWidth = w / timeData.length;
    let x = 0;

    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0;
      const y = (v * h) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  /** Render static waveform preview for recorded AudioBuffer */
  static drawStaticWaveform(canvas, audioBuffer) {
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = (canvas.parentElement.clientWidth * (window.devicePixelRatio || 1)) || 600;
    const h = canvas.height = (canvas.parentElement.clientHeight * (window.devicePixelRatio || 1)) || 120;

    ctx.clearRect(0, 0, w, h);

    const rawData = audioBuffer.getChannelData(0);
    const samples = Math.floor(w);
    const blockSize = Math.floor(rawData.length / samples);
    const filteredData = [];

    for (let i = 0; i < samples; i++) {
      let blockStart = blockSize * i;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[blockStart + j] || 0);
      }
      filteredData.push(sum / blockSize);
    }

    const maxVal = Math.max(...filteredData) || 1;
    const barWidth = 2;
    const gap = 1;

    for (let i = 0; i < samples; i += (barWidth + gap)) {
      const height = (filteredData[i] / maxVal) * (h * 0.85);
      const x = i;
      const y = (h - height) / 2;

      ctx.fillStyle = '#e4e4e7';
      ctx.fillRect(x, y, barWidth, height);
    }
  }
}
