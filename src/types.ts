export type LfoWaveform = 'sine' | 'triangle' | 'sawtooth' | 'square';

export type AudioSourceType = 'synth' | 'tone' | 'noise' | 'file' | 'mic';

export interface TapeParameters {
  // Wow (Slow drift: 0.2 - 1.0 Hz, 1 - 5 ms)
  wowFreq: number; // Hz
  wowDepth: number; // ms
  wowWaveform: LfoWaveform;
  wowEnabled: boolean;

  // Flutter (Fast shimmer: 4 - 15 Hz, 0.1 - 0.8 ms)
  flutterFreq: number; // Hz
  flutterDepth: number; // ms
  flutterWaveform: LfoWaveform;
  flutterEnabled: boolean;

  // Delay base
  baseDelay: number; // ms (e.g. 25ms base for chorus/vibrato, up to 350ms for echo)
  feedback: number; // 0.0 - 0.85
  mix: number; // 0.0 (dry) - 1.0 (wet)

  // Tape warmth / degradation
  saturation: number; // 0.0 (clean) - 1.0 (warm drive)
  toneRollOff: number; // Hz (high cut, 2000 - 20000 Hz)
  tapeHiss: number; // 0.0 - 0.2
  dropouts: boolean;

  // Master output
  outputGain: number; // 0.0 - 1.5
  isBypassed: boolean;
  motorSpeed: number; // 0.2 - 2.0 (normal 1.0, affects tape speed)
}

export interface Preset {
  id: string;
  name: string;
  category: string;
  description: string;
  params: Partial<TapeParameters>;
}

export interface AudioEngineMetrics {
  currentDelayMs: number;
  wowOffsetMs: number;
  flutterOffsetMs: number;
  totalModulationMs: number;
  instantaneousPitchShiftCents: number;
  isPlaying: boolean;
  isMotorStopped: boolean;
}
