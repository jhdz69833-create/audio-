import React from 'react';
import { TapeParameters, LfoWaveform } from '../types';
import { Sliders, Radio, Activity, Volume2, Flame, Gauge, Disc } from 'lucide-react';

interface TapeControlsProps {
  params: TapeParameters;
  onChange: (updated: Partial<TapeParameters>) => void;
}

export const TapeControls: React.FC<TapeControlsProps> = ({ params, onChange }) => {
  const waveforms: LfoWaveform[] = ['sine', 'triangle', 'sawtooth', 'square'];

  return (
    <div id="tape-controls" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* SECTION 1: LFO 1 - WOW (Slow Drift) */}
      <div className="flex flex-col rounded-xl border border-stone-800 bg-stone-900/80 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between border-b border-stone-800 pb-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-200">
              LFO 1: Wow (Slow Drift)
            </span>
          </div>
          <button
            onClick={() => onChange({ wowEnabled: !params.wowEnabled })}
            className={`rounded px-2 py-0.5 text-[11px] font-mono font-medium transition-colors ${
              params.wowEnabled
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-stone-800 text-stone-500 border border-stone-700'
            }`}
          >
            {params.wowEnabled ? 'ACTIVE' : 'OFF'}
          </button>
        </div>

        <p className="mb-3 text-[11px] text-stone-400 leading-relaxed">
          Simulates uneven tape reels and motor capstan drag (0.2 Hz – 1.0 Hz, 1 – 5 ms).
        </p>

        {/* Wow Frequency */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-stone-400">Rate / Frequency:</span>
            <span className="font-mono text-amber-400">{params.wowFreq.toFixed(2)} Hz</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.02"
            value={params.wowFreq}
            onChange={e => onChange({ wowFreq: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-stone-500 font-mono">
            <span>0.1 Hz</span>
            <span>0.5 Hz (Spec)</span>
            <span>2.0 Hz</span>
          </div>
        </div>

        {/* Wow Depth */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-stone-400">Modulation Depth (Gain):</span>
            <span className="font-mono text-amber-400">±{params.wowDepth.toFixed(1)} ms</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="8.0"
            step="0.1"
            value={params.wowDepth}
            onChange={e => onChange({ wowDepth: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-stone-500 font-mono">
            <span>0 ms</span>
            <span>±2.0 ms (Spec)</span>
            <span>8.0 ms</span>
          </div>
        </div>

        {/* Wow Waveform */}
        <div>
          <span className="mb-1 block text-xs text-stone-400">LFO Shape:</span>
          <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
            {waveforms.map(wf => (
              <button
                key={wf}
                onClick={() => onChange({ wowWaveform: wf })}
                className={`rounded px-2 py-1 uppercase text-[11px] transition-colors ${
                  params.wowWaveform === wf
                    ? 'bg-amber-500 text-stone-950 font-semibold'
                    : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                }`}
              >
                {wf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2: LFO 2 - FLUTTER (Fast Shimmer) */}
      <div className="flex flex-col rounded-xl border border-stone-800 bg-stone-900/80 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between border-b border-stone-800 pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-200">
              LFO 2: Flutter (Fast Shimmer)
            </span>
          </div>
          <button
            onClick={() => onChange({ flutterEnabled: !params.flutterEnabled })}
            className={`rounded px-2 py-0.5 text-[11px] font-mono font-medium transition-colors ${
              params.flutterEnabled
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'bg-stone-800 text-stone-500 border border-stone-700'
            }`}
          >
            {params.flutterEnabled ? 'ACTIVE' : 'OFF'}
          </button>
        </div>

        <p className="mb-3 text-[11px] text-stone-400 leading-relaxed">
          Models capstan friction, roller eccentricity, and vibration (4 Hz – 15 Hz, 0.1 – 0.8 ms).
        </p>

        {/* Flutter Frequency */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-stone-400">Rate / Frequency:</span>
            <span className="font-mono text-cyan-400">{params.flutterFreq.toFixed(1)} Hz</span>
          </div>
          <input
            type="range"
            min="2.0"
            max="18.0"
            step="0.2"
            value={params.flutterFreq}
            onChange={e => onChange({ flutterFreq: parseFloat(e.target.value) })}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-stone-500 font-mono">
            <span>2.0 Hz</span>
            <span>6.0 Hz (Spec)</span>
            <span>18.0 Hz</span>
          </div>
        </div>

        {/* Flutter Depth */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-stone-400">Modulation Depth (Gain):</span>
            <span className="font-mono text-cyan-400">±{params.flutterDepth.toFixed(2)} ms</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.5"
            step="0.02"
            value={params.flutterDepth}
            onChange={e => onChange({ flutterDepth: parseFloat(e.target.value) })}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-stone-500 font-mono">
            <span>0 ms</span>
            <span>±0.30 ms (Spec)</span>
            <span>1.5 ms</span>
          </div>
        </div>

        {/* Flutter Waveform */}
        <div>
          <span className="mb-1 block text-xs text-stone-400">LFO Shape:</span>
          <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
            {waveforms.map(wf => (
              <button
                key={wf}
                onClick={() => onChange({ flutterWaveform: wf })}
                className={`rounded px-2 py-1 uppercase text-[11px] transition-colors ${
                  params.flutterWaveform === wf
                    ? 'bg-cyan-400 text-stone-950 font-semibold'
                    : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                }`}
              >
                {wf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 3: DELAY LINE & TAPE SATURATION */}
      <div className="flex flex-col rounded-xl border border-stone-800 bg-stone-900/80 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between border-b border-stone-800 pb-2">
          <div className="flex items-center gap-2">
            <Disc className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-200">
              Delay Line & Color
            </span>
          </div>
          <button
            onClick={() => onChange({ isBypassed: !params.isBypassed })}
            className={`rounded px-2 py-0.5 text-[11px] font-mono font-medium transition-colors ${
              params.isBypassed
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            }`}
          >
            {params.isBypassed ? 'BYPASS (DRY)' : 'ACTIVE'}
          </button>
        </div>

        {/* Base Delay Time */}
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-stone-400">Base Delay (τ₀):</span>
            <span className="font-mono text-emerald-400">{params.baseDelay.toFixed(0)} ms</span>
          </div>
          <input
            type="range"
            min="10"
            max="250"
            step="1"
            value={params.baseDelay}
            onChange={e => onChange({ baseDelay: parseFloat(e.target.value) })}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-stone-500 font-mono">
            <span>20ms (Chorus/Vibrato)</span>
            <span>120ms (Slapback)</span>
          </div>
        </div>

        {/* Mix */}
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-stone-400">Dry / Wet Mix:</span>
            <span className="font-mono text-stone-300">
              {params.mix === 1 ? '100% Wet (Vibrato)' : `${Math.round(params.mix * 100)}% Wet`}
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.02"
            value={params.mix}
            onChange={e => onChange({ mix: parseFloat(e.target.value) })}
            className="w-full accent-stone-300 cursor-pointer"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-stone-500 font-mono">
            <span>0% Dry</span>
            <span>50% Chorus</span>
            <span>100% Vibrato</span>
          </div>
        </div>

        {/* Feedback */}
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-stone-400">Delay Feedback:</span>
            <span className="font-mono text-stone-300">{Math.round(params.feedback * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="0.75"
            step="0.02"
            value={params.feedback}
            onChange={e => onChange({ feedback: parseFloat(e.target.value) })}
            className="w-full accent-stone-300 cursor-pointer"
          />
        </div>

        {/* Saturation & Tone */}
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-stone-800">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-stone-400 flex items-center gap-1">
                <Flame className="h-3 w-3 text-orange-400" /> Saturation
              </span>
              <span className="font-mono text-orange-400">{Math.round(params.saturation * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={params.saturation}
              onChange={e => onChange({ saturation: parseFloat(e.target.value) })}
              className="w-full accent-orange-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-stone-400">Tone Cutoff</span>
              <span className="font-mono text-stone-300">{(params.toneRollOff / 1000).toFixed(1)}k</span>
            </div>
            <input
              type="range"
              min="2000"
              max="18000"
              step="500"
              value={params.toneRollOff}
              onChange={e => onChange({ toneRollOff: parseFloat(e.target.value) })}
              className="w-full accent-stone-300 cursor-pointer"
            />
          </div>
        </div>

        {/* Tape Hiss & Dropouts */}
        <div className="mt-3 flex items-center justify-between border-t border-stone-800 pt-2 text-xs">
          <div className="flex items-center gap-2">
            <Volume2 className="h-3.5 w-3.5 text-stone-400" />
            <span className="text-stone-400">Tape Hiss:</span>
            <input
              type="range"
              min="0.0"
              max="0.2"
              step="0.01"
              value={params.tapeHiss}
              onChange={e => onChange({ tapeHiss: parseFloat(e.target.value) })}
              className="w-20 accent-stone-400 cursor-pointer"
            />
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-stone-300">
            <input
              type="checkbox"
              checked={params.dropouts}
              onChange={e => onChange({ dropouts: e.target.checked })}
              className="rounded bg-stone-800 text-amber-500 focus:ring-0"
            />
            <span>Oxide Dropouts</span>
          </label>
        </div>
      </div>
    </div>
  );
};
