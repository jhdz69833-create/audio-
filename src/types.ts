export type WaveformType = 'sine' | 'triangle' | 'sawtooth' | 'square';

export type AudioSourceType = 'synth' | 'tone' | 'noise' | 'file' | 'mic' | 'drive';

export interface DriveAudioInfo {
  id: string;
  name: string;
  size?: string;
}

export interface TapeParameters {
  wowFreq: number; // Hz (0.1 - 2.0 Hz)
  wowDepth: number; // ms (0 - 8 ms)
  wowWaveform: WaveformType;
  wowEnabled: boolean;

  flutterFreq: number; // Hz (2 - 18 Hz)
  flutterDepth: number; // ms (0 - 1.5 ms)
  flutterWaveform: WaveformType;
  flutterEnabled: boolean;

  baseDelay: number; // ms (10 - 250 ms)
  feedback: number; // 0 - 0.75
  mix: number; // 0 (dry) - 1.0 (wet)
  saturation: number; // 0 - 1.0
  toneRollOff: number; // Hz (2000 - 18000 Hz)
  tapeHiss: number; // 0 - 0.2
  dropouts: boolean;
  motorSpeed: number; // multiplier (e.g. 0.8 - 1.2)
  outputGain: number; // master output volume
  isBypassed: boolean;
}

export interface TapeMetrics {
  currentDelayMs: number;
  wowOffsetMs: number;
  flutterOffsetMs: number;
  totalModulationMs: number;
  instantaneousPitchShiftCents: number;
  isPlaying: boolean;
  isMotorStopped: boolean;
}

export interface TapePreset {
  id: string;
  name: string;
  category: string;
  description: string;
  params: Partial<TapeParameters>;
}
