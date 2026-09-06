import React from 'react';
import { Cpu, Radio, Activity, ArrowRight } from 'lucide-react';
import { TapeParameters, TapeMetrics } from '../types';

interface SignalFlowProps {
  params: TapeParameters;
  metrics: TapeMetrics;
}

export const SignalFlow: React.FC<SignalFlowProps> = ({ params, metrics }) => {
  return (
    <div id="signal-flow-card" className="flex flex-col rounded-xl border border-stone-800 bg-stone-900/80 p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold tracking-wider uppercase text-stone-300">
            Web Audio API Signal Routing & Modulation Graph
          </span>
        </div>
        <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400">
          AudioParam Direct Connection
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-stone-800/80 bg-stone-950 p-3 text-xs">
        {/* LFO Modulation Matrix direct to DelayNode.delayTime */}
        <div className="relative rounded-md border border-amber-500/30 bg-amber-950/10 p-3">
          <div className="absolute -top-2.5 left-3 bg-stone-950 px-1.5 text-[10px] font-mono font-medium text-amber-400">
            LFO MODULATION MATRIX → DelayNode.delayTime
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-2 pt-1 text-[11px] font-mono">
            {/* Wow Source */}
            <div className="md:col-span-4 flex items-center justify-between rounded bg-stone-900 border border-stone-800 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <Radio className={`h-3 w-3 ${params.wowEnabled ? 'text-amber-400 animate-pulse' : 'text-stone-600'}`} />
                <span className="text-stone-200">LFO 1: Wow</span>
              </div>
              <span className="text-amber-400">{params.wowFreq.toFixed(2)} Hz</span>
            </div>

            <div className="hidden md:flex md:col-span-1 justify-center text-stone-600">
              <ArrowRight className="h-3 w-3" />
            </div>

            {/* Wow Gain */}
            <div className="md:col-span-3 flex items-center justify-between rounded bg-stone-900 border border-stone-800 px-2.5 py-1.5">
              <span className="text-stone-400">Gain (Depth)</span>
              <span className="text-amber-300">±{params.wowDepth.toFixed(1)} ms</span>
            </div>

            <div className="hidden md:flex md:col-span-1 justify-center text-stone-600">
              <ArrowRight className="h-3 w-3" />
            </div>

            {/* Shared Destination DelayNode.delayTime */}
            <div className="md:col-span-3 row-span-2 flex flex-col justify-center rounded border border-emerald-500/40 bg-emerald-950/20 p-2.5 text-center">
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Target AudioParam</span>
              <span className="text-xs font-mono font-bold text-emerald-300 mt-0.5">DelayNode.delayTime</span>
              <span className="mt-1 text-[10px] text-stone-400">
                Base: {params.baseDelay}ms (Curr: {metrics.currentDelayMs.toFixed(1)}ms)
              </span>
            </div>

            {/* Flutter Source */}
            <div className="md:col-span-4 flex items-center justify-between rounded bg-stone-900 border border-stone-800 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <Activity className={`h-3 w-3 ${params.flutterEnabled ? 'text-cyan-400 animate-pulse' : 'text-stone-600'}`} />
                <span className="text-stone-200">LFO 2: Flutter</span>
              </div>
              <span className="text-cyan-400">{params.flutterFreq.toFixed(1)} Hz</span>
            </div>

            <div className="hidden md:flex md:col-span-1 justify-center text-stone-600">
              <ArrowRight className="h-3 w-3" />
            </div>

            {/* Flutter Gain */}
            <div className="md:col-span-3 flex items-center justify-between rounded bg-stone-900 border border-stone-800 px-2.5 py-1.5">
              <span className="text-stone-400">Gain (Depth)</span>
              <span className="text-cyan-300">±{params.flutterDepth.toFixed(2)} ms</span>
            </div>

            <div className="hidden md:flex md:col-span-1 justify-center text-stone-600">
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>

        {/* Audio Path Pipeline Diagram */}
        <div className="flex flex-wrap items-center justify-between gap-1 rounded-md border border-stone-800/80 bg-stone-900/60 p-2 text-[10px] font-mono text-stone-400">
          <div className="rounded bg-stone-800 px-2 py-1 text-stone-200">Audio Source</div>
          <ArrowRight className="h-3 w-3 text-stone-600" />
          <div className="rounded bg-stone-800 px-2 py-1 text-stone-200">
            Tape Saturation ({Math.round(params.saturation * 100)}%)
          </div>
          <ArrowRight className="h-3 w-3 text-stone-600" />
          <div className="rounded bg-stone-800 px-2 py-1 text-stone-200">
            Head Filter ({Math.round(params.toneRollOff)}Hz)
          </div>
          <ArrowRight className="h-3 w-3 text-stone-600" />
          <div className="rounded border border-emerald-500/40 bg-emerald-950/40 px-2 py-1 text-emerald-300 font-semibold">
            Modulated DelayLine
          </div>
          <ArrowRight className="h-3 w-3 text-stone-600" />
          <div className="rounded bg-stone-800 px-2 py-1 text-stone-200">
            Mixer ({Math.round(params.mix * 100)}% Wet)
          </div>
          <ArrowRight className="h-3 w-3 text-stone-600" />
          <div className="rounded bg-amber-500/20 px-2 py-1 text-amber-300 font-semibold">Audio Output</div>
        </div>
      </div>
    </div>
  );
};
