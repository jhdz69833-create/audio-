import { TapeParameters, AudioSourceType, AudioEngineMetrics } from '../types';

// Creates a soft-saturation curve for tape drive modeling
function createTapeCurve(saturation: number, samples = 1024): Float32Array {
  const curve = new Float32Array(samples);
  const k = Math.max(0, saturation) * 4; // drive coefficient
  
  for (let i = 0; i < samples; ++i) {
    const x = (i * 2) / samples - 1;
    if (k === 0) {
      curve[i] = x;
    } else {
      // Soft saturation using tanh-like polynomial
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
  }
  return curve;
}

// Generates looping pink/tape noise buffer
function createTapeHissBuffer(audioCtx: AudioContext, seconds = 3): AudioBuffer {
  const bufferSize = audioCtx.sampleRate * seconds;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

export class TapeAudioEngine {
  private ctx: AudioContext | null = null;
  private isInitialized = false;

  // Audio Nodes
  private inputNode: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private feedbackGain: GainNode | null = null;
  private tapeFilter: BiquadFilterNode | null = null;
  private headBumpFilter: BiquadFilterNode | null = null;
  private saturationNode: WaveShaperNode | null = null;
  private saturationPreGain: GainNode | null = null;
  private dropoutGain: GainNode | null = null;

  // Modulation (LFOs directly modulating delayNode.delayTime)
  private lfo1Wow: OscillatorNode | null = null;
  private lfo1Gain: GainNode | null = null;
  private lfo2Flutter: OscillatorNode | null = null;
  private lfo2Gain: GainNode | null = null;

  // Tape Hiss
  private hissSource: AudioBufferSourceNode | null = null;
  private hissGain: GainNode | null = null;
  private hissFilter: BiquadFilterNode | null = null;

  // Analyser
  private analyser: AnalyserNode | null = null;

  // Built-in Sources
  private currentSourceType: AudioSourceType = 'synth';
  private testToneOsc: OscillatorNode | null = null;
  private testToneGain: GainNode | null = null;
  private synthInterval: number | null = null;
  private activeVoices: OscillatorNode[] = [];
  private userAudioSource: AudioBufferSourceNode | null = null;
  private userAudioBuffer: AudioBuffer | null = null;
  private micStream: MediaStream | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;

  // State
  private isPlaying = false;
  private isMotorStopped = false;
  private params: TapeParameters;
  private dropoutTimer: number | null = null;

  constructor(initialParams: TapeParameters) {
    this.params = { ...initialParams };
  }

  public async init(): Promise<void> {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Input & Output
    this.inputNode = this.ctx.createGain();
    this.dryGain = this.ctx.createGain();
    this.wetGain = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;

    // Tape Delay Line (Max 2 seconds buffer)
    this.delayNode = this.ctx.createDelay(2.0);
    this.feedbackGain = this.ctx.createGain();
    
    // Tape Saturation & Filters
    this.saturationPreGain = this.ctx.createGain();
    this.saturationNode = this.ctx.createWaveShaper();
    this.saturationNode.oversample = '2x';
    this.tapeFilter = this.ctx.createBiquadFilter();
    this.tapeFilter.type = 'lowpass';
    this.headBumpFilter = this.ctx.createBiquadFilter();
    this.headBumpFilter.type = 'peaking';
    this.headBumpFilter.frequency.value = 65; // Tape head bass resonance
    this.headBumpFilter.Q.value = 1.2;
    this.headBumpFilter.gain.value = 2.5;

    this.dropoutGain = this.ctx.createGain();

    // LFO 1: Wow (Low frequency drift)
    this.lfo1Wow = this.ctx.createOscillator();
    this.lfo1Gain = this.ctx.createGain();
    this.lfo1Wow.connect(this.lfo1Gain);

    // LFO 2: Flutter (Higher frequency shimmer)
    this.lfo2Flutter = this.ctx.createOscillator();
    this.lfo2Gain = this.ctx.createGain();
    this.lfo2Flutter.connect(this.lfo2Gain);

    // ROUTING PER SPECIFICATION:
    // Connect LFO output gain nodes directly to delayNode.delayTime AudioParam!
    this.lfo1Gain.connect(this.delayNode.delayTime);
    this.lfo2Gain.connect(this.delayNode.delayTime);

    // Dry path: Input -> Dry Gain -> Master -> Analyser -> Output
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.masterGain);

    // Wet path: Input -> Saturation -> Head Bump -> Tape Lowpass -> Delay Node -> Dropout Gain -> Wet Gain -> Master
    this.inputNode.connect(this.saturationPreGain);
    this.saturationPreGain.connect(this.saturationNode);
    this.saturationNode.connect(this.headBumpFilter);
    this.headBumpFilter.connect(this.tapeFilter);
    this.tapeFilter.connect(this.delayNode);

    // Delay Feedback loop: Delay -> Feedback Gain -> TapeFilter (filtered feedback repeats)
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.tapeFilter);

    // Delay to Wet Output
    this.delayNode.connect(this.dropoutGain);
    this.dropoutGain.connect(this.wetGain);
    this.wetGain.connect(this.masterGain);

    // Master to Analyser to Destination
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Setup Tape Hiss
    this.setupTapeHiss();

    // Start LFOs
    this.lfo1Wow.start();
    this.lfo2Flutter.start();

    // Apply current parameters
    this.applyParameters(this.params);

    this.isInitialized = true;
    this.startDropoutsMonitoring();
  }

  private setupTapeHiss() {
    if (!this.ctx || !this.wetGain) return;
    try {
      const hissBuffer = createTapeHissBuffer(this.ctx);
      this.hissSource = this.ctx.createBufferSource();
      this.hissSource.buffer = hissBuffer;
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
    } catch (err) {
      console.warn('Tape hiss init note:', err);
    }
  }

  public applyParameters(p: TapeParameters): void {
    this.params = { ...p };
    if (!this.ctx || !this.isInitialized) return;

    const now = this.ctx.currentTime;
    const rampTime = 0.04;

    // If bypassed, dry = 1, wet = 0
    if (p.isBypassed) {
      this.dryGain?.gain.setTargetAtTime(1.0, now, rampTime);
      this.wetGain?.gain.setTargetAtTime(0.0, now, rampTime);
    } else {
      this.dryGain?.gain.setTargetAtTime(1.0 - p.mix, now, rampTime);
      this.wetGain?.gain.setTargetAtTime(p.mix, now, rampTime);
    }

    // Base Delay time (ms to seconds)
    const effectiveDelay = (p.baseDelay / 1000) * (1 / (p.motorSpeed || 1));
    this.delayNode?.delayTime.setTargetAtTime(effectiveDelay, now, rampTime);

    // LFO 1: Wow
    if (this.lfo1Wow && this.lfo1Gain) {
      this.lfo1Wow.type = p.wowWaveform;
      this.lfo1Wow.frequency.setTargetAtTime(p.wowFreq * p.motorSpeed, now, rampTime);
      const wowSeconds = p.wowEnabled ? (p.wowDepth / 1000) : 0;
      this.lfo1Gain.gain.setTargetAtTime(wowSeconds, now, rampTime);
    }

    // LFO 2: Flutter
    if (this.lfo2Flutter && this.lfo2Gain) {
      this.lfo2Flutter.type = p.flutterWaveform;
      this.lfo2Flutter.frequency.setTargetAtTime(p.flutterFreq * p.motorSpeed, now, rampTime);
      const flutterSeconds = p.flutterEnabled ? (p.flutterDepth / 1000) : 0;
      this.lfo2Gain.gain.setTargetAtTime(flutterSeconds, now, rampTime);
    }

    // Feedback
    this.feedbackGain?.gain.setTargetAtTime(Math.min(0.85, p.feedback), now, rampTime);

    // Tone Lowpass
    this.tapeFilter?.frequency.setTargetAtTime(p.toneRollOff * p.motorSpeed, now, rampTime);

    // Saturation
    if (this.saturationNode) {
      this.saturationNode.curve = createTapeCurve(p.saturation) as unknown as Float32Array<ArrayBuffer>;
      this.saturationPreGain?.gain.setTargetAtTime(1.0 + p.saturation * 1.5, now, rampTime);
    }

    // Tape Hiss
    if (this.hissGain) {
      const hissLevel = p.isBypassed ? 0 : p.tapeHiss * 0.15;
      this.hissGain.gain.setTargetAtTime(hissLevel, now, rampTime);
    }

    // Master
    this.masterGain?.gain.setTargetAtTime(p.outputGain, now, rampTime);
  }

  private startDropoutsMonitoring() {
    if (this.dropoutTimer) clearInterval(this.dropoutTimer);

    this.dropoutTimer = window.setInterval(() => {
      if (!this.ctx || !this.params.dropouts || !this.dropoutGain || this.isMotorStopped || !this.isPlaying) return;

      // Random chance of tape oxide dropout (small dip in amplitude)
      if (Math.random() < 0.25) {
        const now = this.ctx.currentTime;
        const dip = 0.2 + Math.random() * 0.4;
        const duration = 0.05 + Math.random() * 0.12;

        this.dropoutGain.gain.cancelScheduledValues(now);
        this.dropoutGain.gain.setValueAtTime(this.dropoutGain.gain.value, now);
        this.dropoutGain.gain.linearRampToValueAtTime(dip, now + 0.02);
        this.dropoutGain.gain.linearRampToValueAtTime(1.0, now + duration);
      }
    }, 1800);
  }

  // --- Motor Drag / Tape Stop Inertial Simulation ---
  public toggleMotorStop(): boolean {
    if (!this.ctx || !this.delayNode || !this.masterGain) return false;
    this.isMotorStopped = !this.isMotorStopped;
    const now = this.ctx.currentTime;

    if (this.isMotorStopped) {
      // Physically simulate reel motor dragging to a halt:
      // Delay time ramps up (tape moves slower past read head), pitch drops severely down!
      this.delayNode.delayTime.cancelScheduledValues(now);
      this.delayNode.delayTime.setValueAtTime(this.delayNode.delayTime.value, now);
      this.delayNode.delayTime.exponentialRampToValueAtTime(0.8, now + 0.75);

      if (this.lfo1Gain) this.lfo1Gain.gain.setTargetAtTime(0, now, 0.4);
      if (this.lfo2Gain) this.lfo2Gain.gain.setTargetAtTime(0, now, 0.4);
    } else {
      // Motor restarts and spins back up to operating speed
      const targetDelay = (this.params.baseDelay / 1000) * (1 / this.params.motorSpeed);
      this.delayNode.delayTime.cancelScheduledValues(now);
      this.delayNode.delayTime.setValueAtTime(this.delayNode.delayTime.value, now);
      this.delayNode.delayTime.exponentialRampToValueAtTime(Math.max(0.005, targetDelay), now + 0.6);

      setTimeout(() => {
        this.applyParameters(this.params);
      }, 600);
    }
    return this.isMotorStopped;
  }

  // --- Audio Source Selection & Playback ---
  public async setSourceType(type: AudioSourceType): Promise<void> {
    await this.init();
    this.stopCurrentSource();
    this.currentSourceType = type;
    if (this.isPlaying) {
      this.startCurrentSource();
    }
  }

  public async startAudio(): Promise<void> {
    await this.init();
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
    this.isPlaying = true;
    this.startCurrentSource();
  }

  public stopAudio(): void {
    this.isPlaying = false;
    this.stopCurrentSource();
  }

  private startCurrentSource(): void {
    if (!this.ctx || !this.inputNode) return;

    switch (this.currentSourceType) {
      case 'synth':
        this.startMelodicKeyboard();
        break;
      case 'tone':
        this.startTestTone();
        break;
      case 'file':
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

  private stopCurrentSource(): void {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    this.activeVoices.forEach(v => {
      try { v.stop(); v.disconnect(); } catch {}
    });
    this.activeVoices = [];

    if (this.testToneOsc) {
      try { this.testToneOsc.stop(); this.testToneOsc.disconnect(); } catch {}
      this.testToneOsc = null;
    }

    if (this.userAudioSource) {
      try { this.userAudioSource.stop(); this.userAudioSource.disconnect(); } catch {}
      this.userAudioSource = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.micNode) {
      this.micNode.disconnect();
      this.micNode = null;
    }
  }

  // 1. Built-in Melodic Synth (Vintage Electric Piano / Lo-Fi Chords)
  private startMelodicKeyboard(): void {
    if (!this.ctx || !this.inputNode) return;

    // Chords: Dm9, G13, Cmaj9, Am9 in Hz
    const chords = [
      [146.83, 220.00, 261.63, 329.63, 392.00], // Dm9 (D3, A3, C4, E4, G4)
      [98.00, 196.00, 246.94, 329.63, 349.23],  // G13 (G2, G3, B3, E4, F4)
      [130.81, 196.00, 246.94, 293.66, 392.00], // Cmaj9 (C3, G3, B3, D4, G4)
      [110.00, 164.81, 220.00, 261.63, 329.63], // Am9 (A2, E3, A3, C4, E4)
    ];

    let chordIndex = 0;

    const playNextChord = () => {
      if (!this.ctx || !this.inputNode || !this.isPlaying) return;
      const notes = chords[chordIndex % chords.length];
      chordIndex++;

      notes.forEach((freq, i) => {
        // Slight strum delay for realistic vintage keyboard feel
        setTimeout(() => {
          if (!this.ctx || !this.inputNode || !this.isPlaying) return;
          this.playKeyVoice(freq, 2.4);
        }, i * 35);
      });
    };

    playNextChord();
    this.synthInterval = window.setInterval(playNextChord, 2600);
  }

  private playKeyVoice(freq: number, duration: number) {
    if (!this.ctx || !this.inputNode) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const voiceGain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    // Warm sub/harmonic layer
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 0.5, now);

    // Vintage Rhodes bell overtone
    const oscTine = this.ctx.createOscillator();
    const tineGain = this.ctx.createGain();
    oscTine.type = 'sine';
    oscTine.frequency.setValueAtTime(freq * 3.98, now);
    tineGain.gain.setValueAtTime(0.12, now);
    tineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    oscTine.connect(tineGain);
    tineGain.connect(voiceGain);

    // Envelope
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(voiceGain);
    osc2.connect(voiceGain);
    voiceGain.connect(this.inputNode);

    osc1.start(now);
    osc2.start(now);
    oscTine.start(now);

    osc1.stop(now + duration);
    osc2.stop(now + duration);
    oscTine.stop(now + duration);

    this.activeVoices.push(osc1, osc2, oscTine);
    setTimeout(() => {
      this.activeVoices = this.activeVoices.filter(v => v !== osc1 && v !== osc2 && v !== oscTine);
      try { voiceGain.disconnect(); } catch {}
    }, duration * 1000 + 100);
  }

  // 2. Pure Sine Test Tone (440 Hz standard A4)
  private startTestTone(): void {
    if (!this.ctx || !this.inputNode) return;
    const now = this.ctx.currentTime;

    this.testToneOsc = this.ctx.createOscillator();
    this.testToneGain = this.ctx.createGain();

    this.testToneOsc.type = 'sine';
    this.testToneOsc.frequency.setValueAtTime(440, now);

    this.testToneGain.gain.setValueAtTime(0.18, now);

    this.testToneOsc.connect(this.testToneGain);
    this.testToneGain.connect(this.inputNode);
    this.testToneOsc.start();
  }

  // 3. Ambient Lo-Fi Percussive Sequence
  private startPercussionLoop(): void {
    if (!this.ctx || !this.inputNode) return;
    let step = 0;

    const playStep = () => {
      if (!this.ctx || !this.inputNode || !this.isPlaying) return;
      const now = this.ctx.currentTime;

      // Kick on step 0 and 4
      if (step === 0 || step === 4) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.frequency.setValueAtTime(130, now);
        kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.15);
        kickGain.gain.setValueAtTime(0.28, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        kickOsc.connect(kickGain);
        kickGain.connect(this.inputNode);
        kickOsc.start(now);
        kickOsc.stop(now + 0.25);
      }

      // Snare / Rimshot on step 2 and 6
      if (step === 2 || step === 6) {
        const snareNoise = this.ctx.createBufferSource();
        const noiseBuf = createTapeHissBuffer(this.ctx, 0.2);
        snareNoise.buffer = noiseBuf;
        const snareFilter = this.ctx.createBiquadFilter();
        snareFilter.type = 'bandpass';
        snareFilter.frequency.value = 1800;
        const snareGain = this.ctx.createGain();
        snareGain.gain.setValueAtTime(0.22, now);
        snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        snareNoise.connect(snareFilter);
        snareFilter.connect(snareGain);
        snareGain.connect(this.inputNode);
        snareNoise.start(now);
        snareNoise.stop(now + 0.18);
      }

      // Melodic plink on steps
      const melodicNotes = [523.25, 587.33, 659.25, 783.99]; // C5, D5, E5, G5
      if (step % 2 === 1) {
        const plink = this.ctx.createOscillator();
        const plinkGain = this.ctx.createGain();
        plink.type = 'sine';
        plink.frequency.setValueAtTime(melodicNotes[step % melodicNotes.length], now);
        plinkGain.gain.setValueAtTime(0.12, now);
        plinkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        plink.connect(plinkGain);
        plinkGain.connect(this.inputNode);
        plink.start(now);
        plink.stop(now + 0.35);
      }

      step = (step + 1) % 8;
    };

    playStep();
    this.synthInterval = window.setInterval(playStep, 320);
  }

  // 4. User uploaded audio file
  public async loadAudioFile(file: File): Promise<void> {
    await this.init();
    if (!this.ctx) return;

    const arrayBuffer = await file.arrayBuffer();
    this.userAudioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.setSourceType('file');
  }

  private startUserFile(): void {
    if (!this.ctx || !this.inputNode || !this.userAudioBuffer) return;
    this.userAudioSource = this.ctx.createBufferSource();
    this.userAudioSource.buffer = this.userAudioBuffer;
    this.userAudioSource.loop = true;
    this.userAudioSource.connect(this.inputNode);
    this.userAudioSource.start();
  }

  // 5. Microphone Input
  private async startMicrophone(): Promise<void> {
    if (!this.ctx || !this.inputNode) return;
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micNode = this.ctx.createMediaStreamSource(this.micStream);
      this.micNode.connect(this.inputNode);
    } catch (err) {
      console.error('Microphone access failed:', err);
    }
  }

  // Play individual keyboard note (for interactive piano keys)
  public triggerManualNote(freq: number): void {
    this.init().then(() => {
      this.playKeyVoice(freq, 1.8);
    });
  }

  // --- Real-Time Metrics & Visualization Data ---
  public getWaveformData(dataArray: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(dataArray as unknown as Uint8Array<ArrayBuffer>);
    }
  }

  public getFrequencyData(dataArray: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(dataArray as unknown as Uint8Array<ArrayBuffer>);
    }
  }

  public getMetrics(): AudioEngineMetrics {
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
    // Calculate instantaneous theoretical offsets based on the mathematical specification:
    // \tau(t) = \tau_0 + A_{\text{wow}}\sin(2\pi f_1 t) + A_{\text{flutter}}\sin(2\pi f_2 t)
    const wowAmp = this.params.wowEnabled ? this.params.wowDepth : 0;
    const flutterAmp = this.params.flutterEnabled ? this.params.flutterDepth : 0;

    const wowOffset = wowAmp * Math.sin(2 * Math.PI * this.params.wowFreq * this.params.motorSpeed * t);
    const flutterOffset = flutterAmp * Math.sin(2 * Math.PI * this.params.flutterFreq * this.params.motorSpeed * t);
    const totalModulation = wowOffset + flutterOffset;
    const currentDelay = Math.max(0.1, this.params.baseDelay + totalModulation);

    // Calculate Doppler shift:
    // d/dt \tau(t) = A_1 \cdot 2\pi f_1 \cos(2\pi f_1 t) + A_2 \cdot 2\pi f_2 \cos(2\pi f_2 t)
    // Rate of change in seconds per second:
    const dtau_dt = ((wowAmp / 1000) * (2 * Math.PI * this.params.wowFreq * this.params.motorSpeed) * Math.cos(2 * Math.PI * this.params.wowFreq * this.params.motorSpeed * t)) +
                    ((flutterAmp / 1000) * (2 * Math.PI * this.params.flutterFreq * this.params.motorSpeed) * Math.cos(2 * Math.PI * this.params.flutterFreq * this.params.motorSpeed * t));
    
    // Doppler relative frequency ratio = 1 / (1 + dtau_dt) \approx 1 - dtau_dt
    // In cents: 1200 * log2(1 - dtau_dt) \approx -1731 * dtau_dt
    const pitchShiftCents = -1731.23 * dtau_dt;

    return {
      currentDelayMs: currentDelay,
      wowOffsetMs: wowOffset,
      flutterOffsetMs: flutterOffset,
      totalModulationMs: totalModulation,
      instantaneousPitchShiftCents: pitchShiftCents,
      isPlaying: this.isPlaying,
      isMotorStopped: this.isMotorStopped,
    };
  }

  public getContextState(): string {
    return this.ctx?.state || 'uninitialized';
  }
}
