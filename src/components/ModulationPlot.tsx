import React, { useEffect, useRef, useState } from 'react';
import { TapeParameters, AudioEngineMetrics } from '../types';
import { TapeAudioEngine } from '../audio/tapeEngine';
import { Waves, BarChart2, Zap } from 'lucide-react';

interface ModulationPlotProps {
  params: TapeParameters;
  metrics: AudioEngineMetrics;
  engine: TapeAudioEngine | null;
}

export const ModulationPlot: React.FC<ModulationPlotProps> = ({
  params,
  metrics,
  engine,
}) => {
  const [viewMode, setViewMode] = useState<'lfo' | 'oscilloscope' | 'spectrum'>('lfo');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    let animationFrameId: number;
    const waveformData = new Uint8Array(512);
    const frequencyData = new Uint8Array(256);

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      timeRef.current += 0.025;

      ctx.clearRect(0, 0, width, height);

      // Dark oscilloscope screen background
      ctx.fillStyle = '#0c0a09';
      ctx.fillRect(0, 0, width, height);

      // Oscilloscope grid lines
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1;

      // Vertical divisions
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal divisions
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center crosshairs
      ctx.strokeStyle = '#292524';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (viewMode === 'lfo') {
        // Render Delay Time Modulation curve: \tau(t) = \tau_0 + A_1 sin(2\pi f_1 t) + A_2 sin(2\pi f_2 t)
        const centerY = height / 2;
        const wowAmp = params.wowEnabled ? params.wowDepth : 0;
        const flutterAmp = params.flutterEnabled ? params.flutterDepth : 0;
        const t0 = timeRef.current;

        // Trace 1: Delay Time Modulation \tau(t) in Amber
        ctx.beginPath();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;

        for (let x = 0; x < width; x++) {
          const simTime = t0 + (x / width) * 2.5; // 2.5 second window
          const wowVal = wowAmp * Math.sin(2 * Math.PI * params.wowFreq * params.motorSpeed * simTime);
          const flutterVal = flutterAmp * Math.sin(2 * Math.PI * params.flutterFreq * params.motorSpeed * simTime);
          const totalMs = wowVal + flutterVal;

          // Scale ms to pixels (e.g. +/- 6 ms range mapped to canvas)
          const y = centerY - (totalMs / 6) * (height * 0.38);

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Trace 2: Doppler Shift Rate d\tau / dt in Cyan/Teal
        ctx.beginPath();
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);

        for (let x = 0; x < width; x++) {
          const simTime = t0 + (x / width) * 2.5;
          const d_wow = (wowAmp / 1000) * (2 * Math.PI * params.wowFreq) * Math.cos(2 * Math.PI * params.wowFreq * simTime);
          const d_flutter = (flutterAmp / 1000) * (2 * Math.PI * params.flutterFreq) * Math.cos(2 * Math.PI * params.flutterFreq * simTime);
          const pitchCents = -1731 * (d_wow + d_flutter);

          const y = centerY - (pitchCents / 45) * (height * 0.38);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Real-time cursor dot at current t
        const currentY = centerY - (metrics.totalModulationMs / 6) * (height * 0.38);
        ctx.beginPath();
        ctx.arc(12, currentY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();

      } else if (viewMode === 'oscilloscope') {
        // Live Audio Time-domain Waveform
        if (engine) {
          engine.getWaveformData(waveformData);
        }

        ctx.beginPath();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;

        const sliceWidth = width / waveformData.length;
        let x = 0;

        for (let i = 0; i < waveformData.length; i++) {
          const v = waveformData[i] / 128.0; // 0 to 2
          const y = (v * height) / 2;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          x += sliceWidth;
        }
        ctx.stroke();

      } else if (viewMode === 'spectrum') {
        // Frequency Spectrum FFT
        if (engine) {
          engine.getFrequencyData(frequencyData);
        }

        const barWidth = (width / frequencyData.length) * 1.6;
        let x = 0;

        for (let i = 0; i < frequencyData.length; i++) {
          const barHeight = (frequencyData[i] / 255) * height;

          const grad = ctx.createLinearGradient(0, height, 0, height - barHeight);
          grad.addColorStop(0, '#f59e0b');
          grad.addColorStop(1, '#ef4444');

          ctx.fillStyle = grad;
          ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

          x += barWidth;
          if (x > width) break;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [viewMode, params, metrics, engine]);

  return (
    <div id="modulation-plot-card" className="flex flex-col rounded-xl border border-stone-800 bg-stone-900/80 p-4 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Waves className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold tracking-wider uppercase text-stone-300">
            Oscilloscope & Modulation Analysis
          </span>
        </div>

        <div className="flex items-center rounded-lg border border-stone-800 bg-stone-950 p-0.5 text-xs">
          <button
            onClick={() => setViewMode('lfo')}
            className={`flex items-center gap-1 rounded px-2.5 py-1 transition-colors ${
              viewMode === 'lfo' ? 'bg-amber-500/20 text-amber-300 font-medium' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Zap className="h-3 w-3" />
            LFO & Doppler
          </button>
          <button
            onClick={() => setViewMode('oscilloscope')}
            className={`flex items-center gap-1 rounded px-2.5 py-1 transition-colors ${
              viewMode === 'oscilloscope' ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Waves className="h-3 w-3" />
            Waveform
          </button>
          <button
            onClick={() => setViewMode('spectrum')}
            className={`flex items-center gap-1 rounded px-2.5 py-1 transition-colors ${
              viewMode === 'spectrum' ? 'bg-rose-500/20 text-rose-300 font-medium' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <BarChart2 className="h-3 w-3" />
            Spectrum
          </button>
        </div>
      </div>

      {/* Screen Canvas */}
      <div className="relative aspect-[2.4/1] w-full overflow-hidden rounded-lg bg-stone-950 border border-stone-800">
        <canvas
          ref={canvasRef}
          width={600}
          height={250}
          className="h-full w-full object-contain"
        />

        {/* Legend */}
        {viewMode === 'lfo' && (
          <div className="absolute bottom-2 left-2 flex items-center gap-3 rounded bg-stone-900/90 px-2 py-1 text-[10px] font-mono backdrop-blur-sm border border-stone-800">
            <span className="flex items-center gap-1 text-amber-400">
              <span className="inline-block h-1.5 w-3 rounded bg-amber-400" />
              Delay τ(t) (±{metrics.totalModulationMs.toFixed(2)}ms)
            </span>
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="inline-block h-1.5 w-3 rounded bg-cyan-400 border border-dashed border-cyan-300" />
              Doppler Δf ({metrics.instantaneousPitchShiftCents.toFixed(1)}¢)
            </span>
          </div>
        )}
      </div>

      {/* Formula Explanation Callout directly from README */}
      <div className="mt-3 rounded-lg border border-stone-800/80 bg-stone-950/60 p-2.5 text-xs text-stone-400">
        <div className="font-mono text-[11px] text-amber-300/90">
          Δf = -f₀ · (d/dt)τ(t) &nbsp;|&nbsp; τ(t) = τ₀ + A_wow·sin(2πf₁t) + A_flutter·sin(2πf₂t)
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-stone-400">
          Modulating the delay time simulates the speed variance between the write and read heads of magnetic tape, causing continuous Doppler pitch shifts (vibrato/warble) and comb filtering when mixed with dry signal (chorus).
        </p>
      </div>
    </div>
  );
};
