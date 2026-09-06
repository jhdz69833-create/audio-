import React, { useRef, useEffect } from 'react';
import { Activity, Gauge } from 'lucide-react';
import { TapeParameters, TapeMetrics } from '../types';

interface ReelDeckProps {
  params: TapeParameters;
  metrics: TapeMetrics;
  isPlaying: boolean;
  onToggleTapeStop: () => void;
}

const drawReel = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rotation: number,
  label: string,
  tapeColor: string,
  fullness: number
) => {
  // Tape pack on reel
  const tapeRadius = radius * (0.45 + fullness * 0.45);
  ctx.beginPath();
  ctx.arc(x, y, tapeRadius, 0, Math.PI * 2);
  ctx.fillStyle = tapeColor;
  ctx.fill();

  // Metal / Acrylic reel flange
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // Outer flange rim
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#78716c';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 3-hole studio NAB reel cutout pattern
  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI) / 3;
    ctx.save();
    ctx.rotate(angle);
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

  // Center hub
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

  // Spindle hole
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#0c0a09';
  ctx.fill();

  ctx.restore();

  // Label above reel
  ctx.fillStyle = '#a8a29e';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y - radius - 8);
};

export const ReelDeck: React.FC<ReelDeckProps> = ({
  params,
  metrics,
  isPlaying,
  onToggleTapeStop,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftAngleRef = useRef(0);
  const rightAngleRef = useRef(0);

  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Chassis dark metallic background
      const chassisGrad = ctx.createLinearGradient(0, 0, 0, h);
      chassisGrad.addColorStop(0, '#1c1917');
      chassisGrad.addColorStop(0.5, '#141210');
      chassisGrad.addColorStop(1, '#0c0a09');
      ctx.fillStyle = chassisGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 1;
      ctx.strokeRect(1, 1, w - 2, h - 2);

      // Reel rotation speed
      let speed = 0;
      if (isPlaying && !metrics.isMotorStopped) {
        const flutterJitter = 1 + metrics.totalModulationMs / 20;
        speed = 0.045 * params.motorSpeed * flutterJitter;
      }
      leftAngleRef.current += speed * 0.95;
      rightAngleRef.current += speed * 1.05;

      const reelY = h * 0.46;
      const leftReelX = w * 0.26;
      const rightReelX = w * 0.74;
      const reelRadius = Math.min(w * 0.19, h * 0.36);

      // Tape path line
      ctx.beginPath();
      ctx.strokeStyle = '#78350f'; // Dark oxide tape ribbon
      ctx.lineWidth = 4;
      ctx.moveTo(leftReelX, reelY + reelRadius * 0.7);
      ctx.quadraticCurveTo(w * 0.38, h * 0.88, w * 0.5, h * 0.86);
      ctx.quadraticCurveTo(w * 0.62, h * 0.88, rightReelX, reelY + reelRadius * 0.7);
      ctx.stroke();

      // Tape Head Block & Capstan Roller in center bottom
      const headX = w * 0.5;
      const headY = h * 0.85;

      // Head block housing
      ctx.fillStyle = '#292524';
      ctx.fillRect(headX - 44, headY - 14, 88, 26);
      ctx.strokeStyle = '#44403c';
      ctx.strokeRect(headX - 44, headY - 14, 88, 26);

      // Record and Play heads
      const heads = [
        { label: 'REC', x: headX - 22, color: '#f59e0b' },
        { label: 'PLAY', x: headX + 22, color: '#10b981' },
      ];

      heads.forEach(hd => {
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.arc(hd.x, headY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isPlaying ? hd.color : '#57534e';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = isPlaying ? hd.color : '#78716c';
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(hd.label, hd.x, headY + 18);
      });

      // Capstan & pinch roller
      ctx.fillStyle = '#a8a29e';
      ctx.beginPath();
      ctx.arc(headX + 42, headY - 2, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw Supply & Takeup reels
      drawReel(ctx, leftReelX, reelY, reelRadius, leftAngleRef.current, 'SUPPLY', '#b45309', 0.65);
      drawReel(ctx, rightReelX, reelY, reelRadius, rightAngleRef.current, 'TAKEUP', '#78350f', 0.8);

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [params, metrics, isPlaying]);

  return (
    <div id="tape-reels-container" className="relative flex flex-col rounded-xl border border-stone-800 bg-stone-900/80 p-4 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${isPlaying && !metrics.isMotorStopped ? 'bg-amber-500 animate-pulse' : 'bg-stone-600'}`} />
          <span className="text-xs font-semibold tracking-wider uppercase text-stone-300">Magnetic Tape Transport Deck</span>
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
        <canvas ref={canvasRef} width={640} height={320} className="h-full w-full object-contain" />
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
