import React, { useEffect, useRef } from 'react';
import { TapeParameters, AudioEngineMetrics } from '../types';
import { Activity, Gauge } from 'lucide-react';

interface TapeReelsVisualizerProps {
  params: TapeParameters;
  metrics: AudioEngineMetrics;
  isPlaying: boolean;
  onToggleTapeStop: () => void;
}

export const TapeReelsVisualizer: React.FC<TapeReelsVisualizerProps> = ({
  params,
  metrics,
  isPlaying,
  onToggleTapeStop,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftAngleRef = useRef(0);
  const rightAngleRef = useRef(0);

  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // Clear
      ctx.clearRect(0, 0, width, height);

      // Analog chassis background
      const chassisGrad = ctx.createLinearGradient(0, 0, 0, height);
      chassisGrad.addColorStop(0, '#1c1917');
      chassisGrad.addColorStop(0.5, '#141210');
      chassisGrad.addColorStop(1, '#0c0a09');
      ctx.fillStyle = chassisGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle metallic grid texture
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 1;
      ctx.strokeRect(1, 1, width - 2, height - 2);

      // Speed calculation
      let speed = 0;
      if (isPlaying && !metrics.isMotorStopped) {
        // Base rotational speed modulated by motor speed and instantaneous Doppler wow
        const wowWobble = 1 + (metrics.totalModulationMs / 20);
        speed = 0.045 * params.motorSpeed * wowWobble;
      }

      leftAngleRef.current += speed * 0.95;
      rightAngleRef.current += speed * 1.05;

      const reelY = height * 0.46;
      const leftReelX = width * 0.26;
      const rightReelX = width * 0.74;
      const reelRadius = Math.min(width * 0.19, height * 0.36);

      // Draw Tape Path between reels
      ctx.beginPath();
      ctx.strokeStyle = '#78350f'; // Dark magnetic tape oxide brown
      ctx.lineWidth = 4;
      // Left reel -> lower guide -> read/write tape head block -> right reel
      ctx.moveTo(leftReelX, reelY + reelRadius * 0.7);
      ctx.quadraticCurveTo(width * 0.38, height * 0.88, width * 0.5, height * 0.86);
      ctx.quadraticCurveTo(width * 0.62, height * 0.88, rightReelX, reelY + reelRadius * 0.7);
      ctx.stroke();

      // Tape Head Block (Center bottom)
      const headBlockX = width * 0.5;
      const headBlockY = height * 0.85;

      // Head assembly casing
      ctx.fillStyle = '#292524';
      ctx.fillRect(headBlockX - 44, headBlockY - 14, 88, 26);
      ctx.strokeStyle = '#44403c';
      ctx.strokeRect(headBlockX - 44, headBlockY - 14, 88, 26);

      // Heads (Erase, Record, Read/Playback)
      const heads = [
        { label: 'REC', x: headBlockX - 22, color: '#f59e0b' },
        { label: 'PLAY', x: headBlockX + 22, color: '#10b981' },
      ];

      heads.forEach(h => {
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.arc(h.x, headBlockY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isPlaying ? h.color : '#57534e';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = isPlaying ? h.color : '#78716c';
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(h.label, h.x, headBlockY + 18);
      });

      // Capstan & Pinch Roller
      ctx.fillStyle = '#a8a29e';
      ctx.beginPath();
      ctx.arc(headBlockX + 42, headBlockY - 2, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw Left Reel
      drawReel(ctx, leftReelX, reelY, reelRadius, leftAngleRef.current, 'SUPPLY', '#b45309', 0.65);

      // Draw Right Reel
      drawReel(ctx, rightReelX, reelY, reelRadius, rightAngleRef.current, 'TAKEUP', '#78350f', 0.8);

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, metrics, params]);

  const drawReel = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    angle: number,
    label: string,
    tapeColor: string,
    tapeFullness: number
  ) => {
    // Tape pack (spooled magnetic tape)
    const tapeRadius = radius * (0.45 + tapeFullness * 0.45);
    ctx.beginPath();
    ctx.arc(cx, cy, tapeRadius, 0, Math.PI * 2);
    ctx.fillStyle = tapeColor;
    ctx.fill();

    // Metallic flange rim
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Aluminum 3-spoke reel pattern
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#78716c';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 3 Cutout Spokes
    for (let i = 0; i < 3; i++) {
      const spokeAngle = (i * 2 * Math.PI) / 3;
      ctx.save();
      ctx.rotate(spokeAngle);

      ctx.beginPath();
      ctx.moveTo(radius * 0.35, -radius * 0.16);
      ctx.lineTo(radius * 0.85, -radius * 0.26);
      ctx.arc(0, 0, radius * 0.86, -0.28, 0.28);
      ctx.lineTo(radius * 0.35, radius * 0.16);
      ctx.closePath();

      ctx.fillStyle = 'rgba(28, 25, 23, 0.65)';
      ctx.fill();
      ctx.strokeStyle = '#57534e';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    // Center aluminum Hub
    const hubGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, radius * 0.28);
    hubGrad.addColorStop(0, '#e7e5e4');
    hubGrad.addColorStop(0.7, '#78716c');
    hubGrad.addColorStop(1, '#292524');
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = '#a8a29e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center spindle hole
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#0c0a09';
    ctx.fill();

    ctx.restore();

    // Reel Tag
    ctx.fillStyle = '#a8a29e';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy - radius - 8);
  };

  return (
    <div id="tape-reels-container" className="relative flex flex-col rounded-xl border border-stone-800 bg-stone-900/80 p-4 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${isPlaying && !metrics.isMotorStopped ? 'bg-amber-500 animate-pulse' : 'bg-stone-600'}`} />
          <span className="text-xs font-semibold tracking-wider uppercase text-stone-300">
            Magnetic Tape Transport Deck
          </span>
          <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-mono text-stone-400">
            {params.motorSpeed.toFixed(2)}x SPEED
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-tape-stop"
            onClick={onToggleTapeStop}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all ${
              metrics.isMotorStopped
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm shadow-red-500/10'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700'
            }`}
            title="Simulates mechanical inertia: slows capstan motor down inducing severe Doppler pitch drop"
          >
            <Gauge className="h-3.5 w-3.5" />
            {metrics.isMotorStopped ? 'Release Motor Brake' : 'Motor Brake (Tape Stop)'}
          </button>
        </div>
      </div>

      <div className="relative aspect-[2/1] w-full overflow-hidden rounded-lg bg-stone-950">
        <canvas
          ref={canvasRef}
          width={640}
          height={320}
          className="h-full w-full object-contain"
        />

        {/* Status Overlay Badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-stone-900/80 px-2 py-1 backdrop-blur-sm border border-stone-800 text-[11px] font-mono text-stone-400">
          <Activity className="h-3 w-3 text-amber-500" />
          <span>Pitch: {metrics.instantaneousPitchShiftCents > 0 ? '+' : ''}{metrics.instantaneousPitchShiftCents.toFixed(1)} cents</span>
        </div>

        <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-md bg-stone-900/80 px-2 py-1 backdrop-blur-sm border border-stone-800 text-[11px] font-mono text-stone-400">
          <span>Delay: {metrics.currentDelayMs.toFixed(2)} ms</span>
        </div>
      </div>
    </div>
  );
};
