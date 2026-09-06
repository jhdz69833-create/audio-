import React, { useState, useRef, useEffect } from 'react';
import { Waves, Zap, BarChart3 } from 'lucide-react';
import { TapeParameters, TapeMetrics } from '../types';
import { AudioEngine } from '../audio/AudioEngine';

interface VisualizerProps {
  params: TapeParameters;
  metrics: TapeMetrics;
  engine: AudioEngine | null;
}

export const Visualizer: React.FC<VisualizerProps> = ({ params, metrics, engine }) => {
  const [viewMode, setViewMode] = useState<'lfo' | 'oscilloscope' | 'spectrum'>('lfo');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    let animId: number;
    const waveData = new Uint8Array(512);
    const freqData = new Uint8Array(256);

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      phaseRef.current += 0.025;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0c0a09';
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Center baseline
      ctx.strokeStyle = '#292524';
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      if (viewMode === 'lfo') {
        const midY = h / 2;
        const wDepth = params.wowEnabled ? params.wowDepth : 0;
        const fDepth = params.flutterEnabled ? params.flutterDepth : 0;
        const phase = phaseRef.current;

        // Draw Delay Modulation Waveform (Amber)
        ctx.beginPath();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        for (let x = 0; x < w; x++) {
          const t = phase + (x / w) * 2.5;
          const wow = wDepth * Math.sin(2 * Math.PI * params.wowFreq * params.motorSpeed * t);
          const flutter = fDepth * Math.sin(2 * Math.PI * params.flutterFreq * params.motorSpeed * t);
          const total = wow + flutter;
          const y = midY - (total / 6.0) * (h * 0.38);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw Doppler Shift Derivative (Cyan dashed line)
        ctx.beginPath();
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        for (let x = 0; x < w; x++) {
          const t = phase + (x / w) * 2.5;
          const dWow = (wDepth / 1000) * (2 * Math.PI * params.wowFreq) * Math.cos(2 * Math.PI * params.wowFreq * t);
          const dFlutter = (fDepth / 1000) * (2 * Math.PI * params.flutterFreq) * Math.cos(2 * Math.PI * params.flutterFreq * t);
          const cents = -1731 * (dWow + dFlutter);
          const y = midY - (cents / 45.0) * (h * 0.38);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Live point indicator
        const currentY = midY - (metrics.totalModulationMs / 6.0) * (h * 0.38);
        ctx.beginPath();
        ctx.arc(12, currentY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      } else if (viewMode === 'oscilloscope') {
        if (engine) engine.getWaveformData(waveData);
        ctx.beginPath();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        const sliceWidth = w / waveData.length;
        let x = 0;
        for (let i = 0; i < waveData.length; i++) {
          const v = waveData[i] / 128.0;
          const y = (v * h) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      } else if (viewMode === 'spectrum') {
        if (engine) engine.getFrequencyData(freqData);
        const barWidth = (w / freqData.length) * 1.6;
        let x = 0;
        for (let i = 0; i < freqData.length; i++) {
          const barHeight = (freqData[i] / 255) * h;
          const grad = ctx.createLinearGradient(0, h, 0, h - barHeight);
          grad.addColorStop(0, '#f59e0b');
          grad.addColorStop(1, '#ef4444');
          ctx.fillStyle = grad;
          ctx.fillRect(x, h - barHeight, barWidth - 1, barHeight);
          x += barWidth;
          if (x > w) break;
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [viewMode, params, metrics, engine]);

  return (
    <div id="modulation-plot-card" className="flex flex-col rounded-xl border border-stone-800 bg-stone-900/80 p-4 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Waves className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold tracking-wider uppercase text-stone-300">Oscilloscope & Modulation Analysis</span>
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
            <BarChart3 className="h-3 w-3" />
            Spectrum
          </button>
        </div>
      </div>

      <div className="relative aspect-[2.4/1] w-full overflow-hidden rounded-lg bg-stone-950 border border-stone-800">
        <canvas ref={canvasRef} width={600} height={250} className="h-full w-full object-contain" />
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
