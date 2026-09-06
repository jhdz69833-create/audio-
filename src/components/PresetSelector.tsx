import React from 'react';
import { Bookmark, Sparkles } from 'lucide-react';
import { TapePreset } from '../types';
import { TAPE_PRESETS } from '../data/presets';

interface PresetSelectorProps {
  currentPresetId: string | null;
  onSelectPreset: (preset: TapePreset) => void;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  currentPresetId,
  onSelectPreset,
}) => {
  return (
    <div id="preset-selector" className="flex flex-col gap-2 rounded-xl border border-stone-800 bg-stone-900/80 p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-300">
            Acoustic & Hardware Profiles (Presets)
          </span>
        </div>
        <span className="text-[11px] text-stone-500 font-mono">Click any preset to audition</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 pt-1">
        {TAPE_PRESETS.map(preset => {
          const isSelected = currentPresetId === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                isSelected
                  ? 'border-amber-500/50 bg-amber-500/10 shadow-sm'
                  : 'border-stone-800 bg-stone-950/60 hover:border-stone-700 hover:bg-stone-900'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500">
                  {preset.category}
                </span>
                {isSelected && <Sparkles className="h-3 w-3 text-amber-400" />}
              </div>
              <span className={`mt-1 text-xs font-semibold ${isSelected ? 'text-amber-300' : 'text-stone-200'}`}>
                {preset.name}
              </span>
              <span className="mt-1 line-clamp-2 text-[10px] text-stone-400 leading-tight">
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
