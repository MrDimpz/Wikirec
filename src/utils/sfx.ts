import { TierName } from '../shared/types';

class SfxEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('wkt_muted') === '1';
    } catch {}
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('wkt_muted', this.muted ? '1' : '0');
    } catch {}
    return this.muted;
  }

  playTileStep(stepIndex: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
    const freq = scale[Math.min(stepIndex, scale.length - 1)];
    this.tone(freq, 0.055, 'sine', 0.08);
  }

  playWordFound(tier: TierName | null, isTitleWord = false) {
    const ctx = this.getContext();
    if (!ctx) return;

    if (isTitleWord || tier === 'title') {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, idx) => {
        setTimeout(() => this.tone(f, 0.16, 'triangle', 0.14), idx * 65);
      });
      return;
    }

    if (tier === 'ultra') {
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((f, idx) => {
        setTimeout(() => this.tone(f, 0.13, 'triangle', 0.12), idx * 55);
      });
      return;
    }

    if (tier === 'rare') {
      const notes = [392.0, 493.88, 587.33];
      notes.forEach((f, idx) => {
        setTimeout(() => this.tone(f, 0.11, 'sine', 0.11), idx * 50);
      });
      return;
    }

    // Common / Three-letter
    this.tone(440, 0.08, 'sine', 0.1);
    setTimeout(() => this.tone(587.33, 0.11, 'sine', 0.1), 50);
  }

  playAlreadyFound() {
    this.tone(310, 0.06, 'sine', 0.07);
    setTimeout(() => this.tone(280, 0.07, 'sine', 0.07), 60);
  }

  playMiss(inArticle = false) {
    if (inArticle) {
      this.tone(349.23, 0.08, 'sine', 0.08);
      setTimeout(() => this.tone(392.0, 0.09, 'sine', 0.08), 65);
    } else {
      this.tone(195, 0.09, 'sawtooth', 0.05);
    }
  }

  playRoundWin() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, idx) => {
      setTimeout(() => this.tone(f, 0.22, 'triangle', 0.14), idx * 80);
    });
  }

  private tone(freq: number, duration: number, type: OscillatorType, gainVal: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }
}

export const sfx = new SfxEngine();
