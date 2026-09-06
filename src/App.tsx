import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Disc, HelpCircle } from 'lucide-react';
import { TapeParameters, TapeMetrics, AudioSourceType, TapePreset } from './types';
import { AudioEngine } from './audio/AudioEngine';
import { DEFAULT_PARAMETERS } from './data/presets';
import { ReelDeck } from './components/ReelDeck';
import { Visualizer } from './components/Visualizer';
import { SignalFlow } from './components/SignalFlow';
import { AudioSourceBar } from './components/AudioSourceBar';
import { TapeControls } from './components/TapeControls';
import { PresetSelector } from './components/PresetSelector';

export default function App() {
  const [params, setParams] = useState<TapeParameters>(DEFAULT_PARAMETERS);
  const [source, setSource] = useState<AudioSourceType>('synth');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentPresetId, setCurrentPresetId] = useState<string | null>('worn-cassette');
  const [metrics, setMetrics] = useState<TapeMetrics>({
    currentDelayMs: 35,
    wowOffsetMs: 0,
    flutterOffsetMs: 0,
    totalModulationMs: 0,
    instantaneousPitchShiftCents: 0,
    isPlaying: false,
    isMotorStopped: false,
  });

  const engineRef = useRef<AudioEngine | null>(null);

  useEffect(() => {
    const eng = new AudioEngine(DEFAULT_PARAMETERS);
    engineRef.current = eng;

    const interval = window.setInterval(() => {
      if (engineRef.current) {
        setMetrics(engineRef.current.getMetrics());
      }
    }, 33);

    return () => {
      clearInterval(interval);
      eng.stopAudio();
    };
  }, []);

  const handleParamChange = useCallback((patch: Partial<TapeParameters>) => {
    setParams(prev => {
      const next = { ...prev, ...patch };
      engineRef.current?.applyParameters(next);
      return next;
    });
    setCurrentPresetId(null);
  }, []);

  const handleSelectPreset = useCallback((preset: TapePreset) => {
    setCurrentPresetId(preset.id);
    setParams(prev => {
      const next = { ...prev, ...preset.params };
      engineRef.current?.applyParameters(next);
      return next;
    });
  }, []);

  const handleTogglePlay = useCallback(async () => {
    if (!engineRef.current) return;
    if (isPlaying) {
      engineRef.current.stopAudio();
      setIsPlaying(false);
    } else {
      await engineRef.current.startAudio();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleSelectSource = useCallback(async (newSource: AudioSourceType) => {
    setSource(newSource);
    if (engineRef.current) {
      await engineRef.current.setSourceType(newSource);
    }
  }, []);

  const handleToggleTapeStop = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.toggleMotorStop();
      setMetrics(engineRef.current.getMetrics());
    }
  }, []);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-800 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner">
                <Disc className="h-5 w-5 animate-[spin_8s_linear_infinite]" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-stone-100 flex items-center gap-2">
                  Tape Wow & Flutter Simulator
                  <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono uppercase text-amber-400 border border-amber-500/20">
                    Web Audio API
                  </span>
                </h1>
                <p className="text-xs text-stone-400">
                  Delay line AudioParam modulation with dual LFOs simulating continuous Doppler pitch shifts
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 flex items-center gap-2">
              <span className="text-stone-500">Base Delay:</span>
              <span className="text-stone-200">{params.baseDelay}ms</span>
            </div>
            <div className="rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 flex items-center gap-2">
              <span className="text-stone-500">Doppler Δf:</span>
              <span
                className={`font-semibold ${
                  Math.abs(metrics.instantaneousPitchShiftCents) > 10 ? 'text-amber-400' : 'text-stone-200'
                }`}
              >
                {metrics.instantaneousPitchShiftCents > 0 ? '+' : ''}
                {metrics.instantaneousPitchShiftCents.toFixed(1)}¢
              </span>
            </div>
            <div className="rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 flex items-center gap-2">
              <span className="text-stone-500">Audio Transport:</span>
              <span className={`font-semibold ${isPlaying ? 'text-emerald-400' : 'text-stone-500'}`}>
                {isPlaying ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>
          </div>
        </header>

        {/* Hardware Presets */}
        <PresetSelector currentPresetId={currentPresetId} onSelectPreset={handleSelectPreset} />

        {/* Audio Source Selector & Transport */}
        <AudioSourceBar
          currentSource={source}
          onSelectSource={handleSelectSource}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          engine={engineRef.current}
        />

        {/* Dual Deck Visuals: Reel Transport & Modulation Oscilloscope */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ReelDeck
            params={params}
            metrics={metrics}
            isPlaying={isPlaying}
            onToggleTapeStop={handleToggleTapeStop}
          />
          <Visualizer params={params} metrics={metrics} engine={engineRef.current} />
        </div>

        {/* Signal Routing Flow Diagram */}
        <SignalFlow params={params} metrics={metrics} />

        {/* Tape Control Sliders */}
        <TapeControls params={params} onChange={handleParamChange} />

        {/* Scientific / Acoustic Principles Explainer */}
        <footer className="mt-4 rounded-xl border border-stone-800 bg-stone-900/60 p-4 text-xs text-stone-400">
          <div className="flex items-center gap-2 text-stone-300 font-semibold mb-1">
            <HelpCircle className="h-4 w-4 text-amber-500" />
            Tape Wow & Flutter Doppler Principle
          </div>
          <p className="leading-relaxed text-[11px] text-stone-400">
            Magnetic tape audio recording writes magnetized particles at a constant speed onto physical tape. When played
            back, motor speed fluctuations (Wow: 0.2–1.0 Hz, 1–5 ms) and capstan eccentricity/vibration (Flutter: 4–15 Hz,
            0.1–0.8 ms) modulate the read head playback speed relative to the write position. In digital signal processing,
            modulating the delay line&apos;s <code className="text-amber-300 font-mono">delayTime AudioParam</code> directly
            via LFOs induces this exact physical Doppler pitch shift without artificial resampling artifacts.
          </p>
        </footer>
      </div>
    </div>
  );
}
