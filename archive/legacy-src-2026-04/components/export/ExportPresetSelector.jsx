/**
 * ExportPresetSelector - Preset selection cards for export modal
 *
 * Displays preset options as clickable cards at the top of the export modal.
 * Shows visual feedback for the selected preset and modification state.
 */

import React from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Default preset definitions
 */
export const PRESET_OPTIONS = [
  {
    id: 'printReady',
    name: 'Print Ready',
    icon: '📄',
    description: 'Optimized for physical printouts',
    config: {
      orientation: 'landscape',
      layoutMode: 'table',
      density: 'standard',
      includeImages: true,
      includeLaneSummary: true,
      includeTalentSummary: true,
    },
  },
  {
    id: 'digitalShare',
    name: 'Digital Share',
    icon: '📱',
    description: 'Clean layout for screens and email',
    config: {
      orientation: 'portrait',
      layoutMode: 'gallery',
      density: 'detailed',
      galleryColumns: '2',
      includeImages: true,
      includeLaneSummary: false,
      includeTalentSummary: false,
    },
  },
  {
    id: 'minimalTable',
    name: 'Minimal Table',
    icon: '📊',
    description: 'Compact data-focused view',
    config: {
      orientation: 'landscape',
      layoutMode: 'table',
      density: 'compact',
      includeImages: false,
      includeLaneSummary: false,
      includeTalentSummary: false,
    },
  },
];

/**
 * Single preset card component
 */
function PresetCard({ preset, isSelected, isModified, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center p-4 rounded-lg border-2 transition-all text-left w-full',
        'hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500/20'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      )}
    >
      {/* Icon */}
      <span className="text-3xl mb-2" role="img" aria-label={preset.name}>
        {preset.icon}
      </span>

      {/* Name with selection indicator */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {preset.name}
        </span>
        {isSelected && !isModified && (
          <Check className="w-4 h-4 text-blue-500" />
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">
        {preset.description}
      </p>

      {/* Modified indicator */}
      {isSelected && isModified && (
        <span className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Modified
        </span>
      )}
    </button>
  );
}

/**
 * @typedef {Object} ExportPresetSelectorProps
 * @property {string | null} activePreset - Currently selected preset ID
 * @property {boolean} isModified - Whether the preset has been modified
 * @property {(presetId: string) => void} onSelectPreset - Callback when preset is selected
 * @property {() => void} onResetToPreset - Callback to reset to current preset defaults
 */

export default function ExportPresetSelector({
  activePreset,
  isModified = false,
  onSelectPreset,
  onResetToPreset,
}) {
  return (
    <div className="space-y-3">
      {/* Header with reset button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Quick Presets
        </h3>
        {activePreset && isModified && (
          <button
            type="button"
            onClick={onResetToPreset}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to {PRESET_OPTIONS.find(p => p.id === activePreset)?.name || 'preset'}
          </button>
        )}
      </div>

      {/* Preset cards */}
      <div className="grid grid-cols-3 gap-3">
        {PRESET_OPTIONS.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            isSelected={activePreset === preset.id}
            isModified={activePreset === preset.id && isModified}
            onClick={() => onSelectPreset(preset.id)}
          />
        ))}
      </div>
    </div>
  );
}
