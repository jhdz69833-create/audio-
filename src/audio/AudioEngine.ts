import { TapeParameters, TapeMetrics, AudioSourceType } from '../types';

export function makeDistortionCurve(amount: number, nSamples = 1024): Float32Array {
  const curve = new Float32Array(nSamples);
  const k = Math.max(0, amount) * 4;
  for (let i = 0; i < nSamples; ++i) {
    const x = (i * 2) / nSamples - 1;
    if (k === 0) {
      curve[i] = x;
    } else {
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
  }
  return curve;
}

export function generatePinkNoiseBuffer(ctx: AudioContext, durationSeconds = 3): AudioBuffer {
  const bufferSize = ctx.sampleRate * durationSeconds;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  isInitialized = false;

  inputNode: GainNode | null = null;
  dryGain: GainNode | null = null;
  wetGain: GainNode | null = null;
  masterGain: GainNode | null = null;

  delayNode: DelayNode | null = null;
  feedbackGain: GainNode | null = null;

  tapeFilter: BiquadFilterNode | null = null;
  headBumpFilter: BiquadFilterNode | null = null;
  saturationNode: WaveShaperNode | null = null;
  saturationPreGain: GainNode | null = null;
  dropoutGain: GainNode | null = null;

  lfo1Wow: OscillatorNode | null = null;
  lfo1Gain: GainNode | null = null;
  lfo2Flutter: OscillatorNode | null = null;
  lfo2Gain: GainNode | null = null;

  hissSource: AudioBufferSourceNode | null = null;
  hissGain: GainNode | null = null;
  hissFilter: BiquadFilterNode | null = null;

  analyser: AnalyserNode | null = null;

  currentSourceType: AudioSourceType = 'synth';
  testToneOsc: OscillatorNode | null = null;
  testToneGain: GainNode | null = null;
  synthInterval: number | null = null;
  activeVoices: OscillatorNode[] = [];
  userAudioSource: AudioBufferSourceNode | null = null;
  userAudioBuffer: AudioBuffer | null = null;
  micStream: MediaStream | null = null;
  micNode: MediaStreamAudioSourceNode | null = null;

  isPlaying = false;
  isMotorStopped = false;
  params: TapeParameters;
  dropoutTimer: number | null = null;

  constructor(initialParams: TapeParameters) {
    this.params = { ...initialParams };
  }

  async init(): Promise<void> {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.inputNode = this.ctx.createGain();
    this.dryGain = this.ctx.createGain();
    this.wetGain = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;

    // Base delay line with maximum delay of 2.0s
    this.delayNode = this.ctx.createDelay(2.0);
    this.feedbackGain = this.ctx.createGain();

    // Saturation and tone filters
    this.saturationPreGain = this.ctx.createGain();
    this.saturationNode = this.ctx.createWaveShaper();
    this.saturationNode.oversample = '2x';

    this.tapeFilter = this.ctx.createBiquadFilter();
    this.tapeFilter.type = 'lowpass';

    // Head-bump bass resonance around 65 Hz
    this.headBumpFilter = this.ctx.createBiquadFilter();
    this.headBumpFilter.type = 'peaking';
    this.headBumpFilter.frequency.value = 65;
    this.headBumpFilter.Q.value = 1.2;
    this.headBumpFilter.gain.value = 2.5;

    this.dropoutGain = this.ctx.createGain();

    // LFO 1: Wow (connected directly to delayNode.delayTime)
    this.lfo1Wow = this.ctx.createOscillator();
    this.lfo1Gain = this.ctx.createGain();
    this.lfo1Wow.connect(this.lfo1Gain);

    // LFO 2: Flutter (connected directly to delayNode.delayTime)
    this.lfo2Flutter = this.ctx.createOscillator();
    this.lfo2Gain = this.ctx.createGain();
    this.lfo2Flutter.connect(this.lfo2Gain);

    // AudioParam direct modulation: both LFO gains output seconds to delayTime
    this.lfo1Gain.connect(this.delayNode.delayTime);
    this.lfo2Gain.connect(this.delayNode.delayTime);

    // Dry path
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.masterGain);

    // Wet path
    this.inputNode.connect(this.saturationPreGain);
    this.saturationPreGain.connect(this.saturationNode);
    this.saturationNode.connect(this.headBumpFilter);
    this.headBumpFilter.connect(this.tapeFilter);
    this.tapeFilter.connect(this.delayNode);

    // Feedback loop
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.tapeFilter);

    // Output of delay through dropouts and wetGain
    this.delayNode.connect(this.dropoutGain);
    this.dropoutGain.connect(this.wetGain);
    this.wetGain.connect(this.masterGain);

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.setupTapeHiss();

    this.lfo1Wow.start();
    this.lfo2Flutter.start();

    this.applyParameters(this.params);
    this.isInitialized = true;
    this.startDropoutsMonitoring();
  }

  setupTapeHiss(): void {
    if (!this.ctx || !this.wetGain) return;
    try {
      const hissBuf = generatePinkNoiseBuffer(this.ctx);
      this.hissSource = this.ctx.createBufferSource();
      this.hissSource.buffer = hissBuf;
      this.hissSource.loop = true;

      this.hissFilter = this.ctx.createBiquadFilter();
      this.hissFilter.type = 'bandpass';
      this.hissFilter.frequency.value = 3500;
      this.hissFilter.Q.value = 0.7;

      this.hissGain = this.ctx.createGain();
      this.hissGain.gain.value = this.params.tapeHiss * 0.15;

      this.hissSource.connect(this.hissFilter);
      this.hissFilter.connect(this.hissGain);
      this.hissGain.connect(this.wetGain);
      this.hissSource.start();
    } catch (e) {
      console.warn('Tape hiss init note:', e);
    }
  }

  applyParameters(newParams: TapeParameters): void {
    this.params = { ...newParams };
    if (!this.ctx || !this.isInitialized) return;

    const t = this.ctx.currentTime;
    const ramp = 0.04;

    if (newParams.isBypassed) {
      this.dryGain?.gain.setTargetAtTime(1.0, t, ramp);
      this.wetGain?.gain.setTargetAtTime(0.0, t, ramp);
    } else {
      this.dryGain?.gain.setTargetAtTime(1.0 - newParams.mix, t, ramp);
      this.wetGain?.gain.setTargetAtTime(newParams.mix, t, ramp);
    }

    const baseDelaySec = (newParams.baseDelay / 1000) * (1 / (newParams.motorSpeed || 1.0));
    this.delayNode?.delayTime.setTargetAtTime(baseDelaySec, t, ramp);

    if (this.lfo1Wow && this.lfo1Gain) {
      this.lfo1Wow.type = newParams.wowWaveform;
      this.lfo1Wow.frequency.setTargetAtTime(newParams.wowFreq * newParams.motorSpeed, t, ramp);
      const wowSec = newParams.wowEnabled ? newParams.wowDepth / 1000 : 0;
      this.lfo1Gain.gain.setTargetAtTime(wowSec, t, ramp);
    }

    if (this.lfo2Flutter && this.lfo2Gain) {
      this.lfo2Flutter.type = newParams.flutterWaveform;
      this.lfo2Flutter.frequency.setTargetAtTime(newParams.flutterFreq * newParams.motorSpeed, t, ramp);
      const flutterSec = newParams.flutterEnabled ? newParams.flutterDepth / 1000 : 0;
      this.lfo2Gain.gain.setTargetAtTime(flutterSec, t, ramp);
    }

    this.feedbackGain?.gain.setTargetAtTime(Math.min(0.85, newParams.feedback), t, ramp);
    this.tapeFilter?.frequency.setTargetAtTime(newParams.toneRollOff * newParams.motorSpeed, t, ramp);

    if (this.saturationNode) {
      this.saturationNode.curve = makeDistortionCurve(newParams.saturation) as unknown as Float32Array<ArrayBuffer>;
      this.saturationPreGain?.gain.setTargetAtTime(1.0 + newParams.saturation * 1.5, t, ramp);
    }

    if (this.hissGain) {
      const hissLevel = newParams.isBypassed ? 0 : newParams.tapeHiss * 0.15;
      this.hissGain.gain.setTargetAtTime(hissLevel, t, ramp);
    }

    this.masterGain?.gain.setTargetAtTime(newParams.outputGain, t, ramp);
  }

  startDropoutsMonitoring(): void {
    if (this.dropoutTimer) clearInterval(this.dropoutTimer);
    this.dropoutTimer = window.setInterval(() => {
      if (!this.ctx || !this.params.dropouts || !this.dropoutGain || this.isMotorStopped || !this.isPlaying) return;
      if (Math.random() < 0.25) {
        const t = this.ctx.currentTime;
        const dip = 0.2 + Math.random() * 0.4;
        const dur = 0.05 + Math.random() * 0.12;
        this.dropoutGain.gain.cancelScheduledValues(t);
        this.dropoutGain.gain.setValueAtTime(this.dropoutGain.gain.value, t);
        this.dropoutGain.gain.linearRampToValueAtTime(dip, t + 0.02);
        this.dropoutGain.gain.linearRampToValueAtTime(1.0, t + dur);
      }
    }, 1800);
  }

  toggleMotorStop(): boolean {
    if (!this.ctx || !this.delayNode || !this.masterGain) return false;
    this.isMotorStopped = !this.isMotorStopped;
    const t = this.ctx.currentTime;

    if (this.isMotorStopped) {
      this.delayNode.delayTime.cancelScheduledValues(t);
      this.delayNode.delayTime.setValueAtTime(this.delayNode.delayTime.value, t);
      this.delayNode.delayTime.exponentialRampToValueAtTime(0.8, t + 0.75);
      if (this.lfo1Gain) this.lfo1Gain.gain.setTargetAtTime(0, t, 0.4);
      if (this.lfo2Gain) this.lfo2Gain.gain.setTargetAtTime(0, t, 0.4);
    } else {
      const targetDelay = (this.params.baseDelay / 1000) * (1 / this.params.motorSpeed);
      this.delayNode.delayTime.cancelScheduledValues(t);
      this.delayNode.delayTime.setValueAtTime(this.delayNode.delayTime.value, t);
      this.delayNode.delayTime.exponentialRampToValueAtTime(Math.max(0.005, targetDelay), t + 0.6);
      setTimeout(() => {
        this.applyParameters(this.params);
      }, 600);
    }

    return this.isMotorStopped;
  }

  async setSourceType(source: AudioSourceType): Promise<void> {
    await this.init();
    this.stopCurrentSource();
    this.currentSourceType = source;
    if (this.isPlaying) {
      this.startCurrentSource();
    }
  }

  async startAudio(): Promise<void> {
    await this.init();
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
    this.isPlaying = true;
    this.startCurrentSource();
  }

  stopAudio(): void {
    this.isPlaying = false;
    this.stopCurrentSource();
  }

  startCurrentSource(): void {
    if (!this.ctx || !this.inputNode) return;
    switch (this.currentSourceType) {
      case 'synth':
        this.startMelodicKeyboard();
        break;
      case 'tone':
        this.startTestTone();
        break;
      case 'file':
      case 'drive':
        this.startUserFile();
        break;
      case 'mic':
        this.startMicrophone();
        break;
      case 'noise':
        this.startPercussionLoop();
        break;
    }
  }

  stopCurrentSource(): void {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    this.activeVoices.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeVoices = [];

    if (this.testToneOsc) {
      try {
        this.testToneOsc.stop();
        this.testToneOsc.disconnect();
      } catch {
        // ignore
      }
      this.testToneOsc = null;
    }

    if (this.userAudioSource) {
      try {
        this.userAudioSource.stop();
        this.userAudioSource.disconnect();
      } catch {
        // ignore
      }
      this.userAudioSource = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach(tr => tr.stop());
      this.micStream = null;
    }
    if (this.micNode) {
      this.micNode.disconnect();
      this.micNode = null;
    }
  }

  startMelodicKeyboard(): void {
    if (!this.ctx || !this.inputNode) return;
    // Nostalgic vintage chords: Dm9, G13, Cmaj9, Am9
    const chordProgressions = [
      [146.83, 220.0, 261.63, 329.63, 392.0], // Dm9
      [98.0, 196.0, 246.94, 329.63, 349.23],  // G7/13
      [130.81, 196.0, 246.94, 293.66, 392.0], // Cmaj9
      [110.0, 164.81, 220.0, 261.63, 329.63], // Am9
    ];

    let chordIdx = 0;
    const playChord = () => {
      if (!this.ctx || !this.inputNode || !this.isPlaying) return;
      const notes = chordProgressions[chordIdx % chordProgressions.length];
      chordIdx++;
      notes.forEach((freq, i) => {
        setTimeout(() => {
          if (!this.ctx || !this.inputNode || !this.isPlaying) return;
          this.playKeyVoice(freq, 2.4);
        }, i * 35);
      });
    };

    playChord();
    this.synthInterval = window.setInterval(playChord, 2600);
  }

  playKeyVoice(freq: number, dur: number): void {
    if (!this.ctx || !this.inputNode) return;
    const t = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, t);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 0.5, t); // Sub-octave warmth

    // Slight tine harmonic
    const oscTine = this.ctx.createOscillator();
    const tineGain = this.ctx.createGain();
    oscTine.type = 'sine';
    oscTine.frequency.setValueAtTime(freq * 3.98, t);
    tineGain.gain.setValueAtTime(0.12, t);
    tineGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    oscTine.connect(tineGain);
    tineGain.connect(gain);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.inputNode);

    osc1.start(t);
    osc2.start(t);
    oscTine.start(t);

    osc1.stop(t + dur);
    osc2.stop(t + dur);
    oscTine.stop(t + dur);

    this.activeVoices.push(osc1, osc2, oscTine);
    setTimeout(() => {
      this.activeVoices = this.activeVoices.filter(o => o !== osc1 && o !== osc2 && o !== oscTine);
      try {
        gain.disconnect();
      } catch {
        // ignore
      }
    }, dur * 1000 + 100);
  }

  startTestTone(): void {
    if (!this.ctx || !this.inputNode) return;
    const t = this.ctx.currentTime;
    this.testToneOsc = this.ctx.createOscillator();
    this.testToneGain = this.ctx.createGain();

    this.testToneOsc.type = 'sine';
    this.testToneOsc.frequency.setValueAtTime(440, t);
    this.testToneGain.gain.setValueAtTime(0.18, t);

    this.testToneOsc.connect(this.testToneGain);
    this.testToneGain.connect(this.inputNode);
    this.testToneOsc.start();
  }

  startPercussionLoop(): void {
    if (!this.ctx || !this.inputNode) return;
    let step = 0;
    const tick = () => {
      if (!this.ctx || !this.inputNode || !this.isPlaying) return;
      const t = this.ctx.currentTime;

      // Kick drum on 0 and 4
      if (step === 0 || step === 4) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.frequency.setValueAtTime(130, t);
        osc.frequency.exponentialRampToValueAtTime(38, t + 0.15);
        g.gain.setValueAtTime(0.28, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(g);
        g.connect(this.inputNode!);
        osc.start(t);
        osc.stop(t + 0.25);
      }

      // Snare on 2 and 6
      if (step === 2 || step === 6) {
        const noise = this.ctx.createBufferSource();
        const buf = generatePinkNoiseBuffer(this.ctx, 0.2);
        noise.buffer = buf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 1800;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        noise.connect(filt);
        filt.connect(g);
        g.connect(this.inputNode!);
        noise.start(t);
        noise.stop(t + 0.18);
      }

      // Synth arp on off-beats
      const arpFreqs = [523.25, 587.33, 659.25, 783.99];
      if (step % 2 === 1) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(arpFreqs[step % arpFreqs.length], t);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(g);
        g.connect(this.inputNode!);
        osc.start(t);
        osc.stop(t + 0.35);
      }

      step = (step + 1) % 8;
    };

    tick();
    this.synthInterval = window.setInterval(tick, 320);
  }

  async loadAudioFile(file: File): Promise<void> {
    await this.init();
    if (!this.ctx) return;
    const arr = await file.arrayBuffer();
    this.userAudioBuffer = await this.ctx.decodeAudioData(arr);
    this.setSourceType('file');
  }

  async loadDriveAudioData(arrayBuffer: ArrayBuffer): Promise<void> {
    await this.init();
    if (!this.ctx) return;
    const copy = arrayBuffer.slice(0);
    this.userAudioBuffer = await this.ctx.decodeAudioData(copy);
    await this.setSourceType('drive');
  }

  startUserFile(): void {
    if (!this.ctx || !this.inputNode || !this.userAudioBuffer) return;
    this.userAudioSource = this.ctx.createBufferSource();
    this.userAudioSource.buffer = this.userAudioBuffer;
    this.userAudioSource.loop = true;
    this.userAudioSource.connect(this.inputNode);
    this.userAudioSource.start();
  }

  async startMicrophone(): Promise<void> {
    if (!this.ctx || !this.inputNode) return;
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micNode = this.ctx.createMediaStreamSource(this.micStream);
      this.micNode.connect(this.inputNode);
    } catch (e) {
      console.error('Microphone access failed:', e);
    }
  }

  triggerManualNote(freq: number): void {
    this.init().then(() => {
      this.playKeyVoice(freq, 1.8);
    });
  }

  getWaveformData(arr: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(arr as unknown as Uint8Array<ArrayBuffer>);
    }
  }

  getFrequencyData(arr: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(arr as unknown as Uint8Array<ArrayBuffer>);
    }
  }

  getMetrics(): TapeMetrics {
    if (!this.ctx || !this.isInitialized) {
      return {
        currentDelayMs: this.params.baseDelay,
        wowOffsetMs: 0,
        flutterOffsetMs: 0,
        totalModulationMs: 0,
        instantaneousPitchShiftCents: 0,
        isPlaying: this.isPlaying,
        isMotorStopped: this.isMotorStopped,
      };
    }

    const t = this.ctx.currentTime;
    const wDepth = this.params.wowEnabled ? this.params.wowDepth : 0;
    const fDepth = this.params.flutterEnabled ? this.params.flutterDepth : 0;

    const wowOffset = wDepth * Math.sin(2 * Math.PI * this.params.wowFreq * this.params.motorSpeed * t);
    const flutterOffset = fDepth * Math.sin(2 * Math.PI * this.params.flutterFreq * this.params.motorSpeed * t);
    const totalMod = wowOffset + flutterOffset;
    const currentDelay = Math.max(0.1, this.params.baseDelay + totalMod);

    // Continuous Doppler pitch shift calculation:
    // dtau/dt = d/dt [ A_w * sin(2*pi*f_w*t) + A_f * sin(2*pi*f_f*t) ]
    // pitch shift in cents ≈ -1731.23 * (dtau/dt)
    const dTauDt =
      (wDepth / 1000) * (2 * Math.PI * this.params.wowFreq * this.params.motorSpeed) * Math.cos(2 * Math.PI * this.params.wowFreq * this.params.motorSpeed * t) +
      (fDepth / 1000) * (2 * Math.PI * this.params.flutterFreq * this.params.motorSpeed) * Math.cos(2 * Math.PI * this.params.flutterFreq * this.params.motorSpeed * t);

    const pitchShiftCents = -1731.23 * dTauDt;

    return {
      currentDelayMs: currentDelay,
      wowOffsetMs: wowOffset,
      flutterOffsetMs: flutterOffset,
      totalModulationMs: totalMod,
      instantaneousPitchShiftCents: pitchShiftCents,
      isPlaying: this.isPlaying,
      isMotorStopped: this.isMotorStopped,
    };
  }

  getContextState(): string {
    return this.ctx?.state || 'uninitialized';
  }
}
