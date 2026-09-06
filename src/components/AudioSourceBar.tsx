import React, { useRef } from 'react';
import { Play, Square, Music, Radio, Drum, Upload, Mic, HardDrive } from 'lucide-react';
import { AudioSourceType } from '../types';
import { AudioEngine } from '../audio/AudioEngine';

interface AudioSourceBarProps {
  currentSource: AudioSourceType;
  onSelectSource: (src: AudioSourceType) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  engine: AudioEngine | null;
  onOpenDrive: () => void;
  driveFileName?: string | null;
}

export const AudioSourceBar: React.FC<AudioSourceBarProps> = ({
  currentSource,
  onSelectSource,
  isPlaying,
  onTogglePlay,
  engine,
  onOpenDrive,
  driveFileName,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && engine) {
      engine.loadAudioFile(file);
    }
  };

  const manualNotes = [
    { label: 'C4', freq: 261.63 },
    { label: 'D4', freq: 293.66 },
    { label: 'E4', freq: 329.63 },
    { label: 'F4', freq: 349.23 },
    { label: 'G4', freq: 392.0 },
    { label: 'A4', freq: 440.0 },
    { label: 'B4', freq: 493.88 },
    { label: 'C5', freq: 523.25 },
  ];

  return (
    <div id="audio-source-bar" className="flex flex-col gap-3 rounded-xl border border-stone-800 bg-stone-900/80 p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Main Transport Play / Stop Button */}
        <div className="flex items-center gap-3">
          <button
            id="btn-master-play"
            onClick={onTogglePlay}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all shadow-md ${
              isPlaying
                ? 'bg-amber-500 text-stone-950 hover:bg-amber-400 shadow-amber-500/20'
                : 'bg-stone-800 text-stone-100 hover:bg-stone-700 border border-stone-700'
            }`}
          >
            {isPlaying ? (
              <>
                <Square className="h-4 w-4 fill-current" />
                Stop Transport
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                Start Transport
              </>
            )}
          </button>
          <span className="text-xs text-stone-400">
            {isPlaying ? 'Tape transport actively rolling' : 'Click to start playback'}
          </span>
        </div>

        {/* Source Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-stone-800 bg-stone-950 p-1 text-xs">
          <button
            onClick={() => onSelectSource('synth')}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 transition-colors ${
              currentSource === 'synth' ? 'bg-amber-500/20 text-amber-300 font-medium' : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Warm vintage Rhodes / electric piano chord progression"
          >
            <Music className="h-3.5 w-3.5" />
            Lo-Fi Rhodes
          </button>
          <button
            onClick={() => onSelectSource('tone')}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 transition-colors ${
              currentSource === 'tone' ? 'bg-amber-500/20 text-amber-300 font-medium' : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Pure 440 Hz Sine wave - best for analyzing Doppler pitch deviation"
          >
            <Radio className="h-3.5 w-3.5" />
            440Hz Sine Tone
          </button>
          <button
            onClick={() => onSelectSource('noise')}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 transition-colors ${
              currentSource === 'noise' ? 'bg-amber-500/20 text-amber-300 font-medium' : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Vintage rhythm loop with kick and tape snare"
          >
            <Drum className="h-3.5 w-3.5" />
            Tape Rhythm
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 transition-colors ${
              currentSource === 'file' ? 'bg-amber-500/20 text-amber-300 font-medium' : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Upload any audio file (MP3, WAV, etc.)"
          >
            <Upload className="h-3.5 w-3.5" />
            Audio File
          </button>
          <button
            onClick={() => {
              onOpenDrive();
            }}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 transition-colors ${
              currentSource === 'drive' ? 'bg-amber-500/20 text-amber-300 font-medium' : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Browse and load audio files from Google Drive"
          >
            <HardDrive className="h-3.5 w-3.5 text-amber-400" />
            <span>Google Drive</span>
            {driveFileName && currentSource === 'drive' && (
              <span className="max-w-[100px] truncate text-[10px] font-mono text-amber-300/80">
                ({driveFileName})
              </span>
            )}
          </button>
          <button
            onClick={() => onSelectSource('mic')}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 transition-colors ${
              currentSource === 'mic' ? 'bg-amber-500/20 text-amber-300 font-medium' : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Process live microphone signal through tape delay"
          >
            <Mic className="h-3.5 w-3.5" />
            Microphone
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*"
            className="hidden"
          />
        </div>
      </div>

      {/* Piano Keys for instant auditioning */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-800/80 pt-2 text-xs">
        <span className="text-[11px] font-mono text-stone-400">Manual Audition Keys:</span>
        <div className="flex items-center gap-1">
          {manualNotes.map(n => (
            <button
              key={n.label}
              onClick={() => engine?.triggerManualNote(n.freq)}
              className="rounded bg-stone-800 hover:bg-stone-700 active:bg-amber-500 active:text-stone-950 px-2 py-1 font-mono text-[11px] text-stone-300 transition-colors border border-stone-700"
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
