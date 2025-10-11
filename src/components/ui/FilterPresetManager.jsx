/**
 * FilterPresetManager - UI for saving/loading/managing filter presets
 * Integrates into existing filter panels on various pages
 */

import { useCallback, useEffect, useState } from 'react';
import { Save, ChevronDown, Star, Trash2, Edit2, Check, X } from 'lucide-react';
import {
  listPresets,
  savePreset,
  deletePreset,
  renamePreset,
  setDefaultPreset,
  getDefaultPreset,
  presetNameExists,
} from '../../lib/filterPresets';
import { Button } from './button';
import { Input } from './input';
import { toast } from '../../lib/toast';

/**
 * FilterPresetManager Component
 * @param {string} page - Page identifier (e.g., 'shots', 'products')
 * @param {Object} currentFilters - Current filter state
 * @param {Function} onLoadPreset - Callback when preset is loaded
 * @param {Function} onClearFilters - Callback to clear all filters
 */
export default function FilterPresetManager({ page, currentFilters, onLoadPreset, onClearFilters }) {
  const [presets, setPresets] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [activePresetId, setActivePresetId] = useState(null);

  // Load presets
  const loadPresetsData = useCallback(() => {
    const loaded = listPresets(page);
    setPresets(loaded);

    // Check for default preset
    const defaultPreset = getDefaultPreset(page);
    if (defaultPreset) {
      setActivePresetId(defaultPreset.id);
    }
  }, [page]);

  useEffect(() => {
    loadPresetsData();
  }, [loadPresetsData]);

  // Handle save preset
  const handleSavePreset = useCallback(
    async e => {
      e?.preventDefault();

      const name = newPresetName.trim();
      if (!name) {
        toast.error('Please enter a preset name');
        return;
      }

      if (presetNameExists(page, name)) {
        toast.error('A preset with this name already exists');
        return;
      }

      setSaving(true);
      try {
        const preset = savePreset(page, name, currentFilters);
        toast.success(`Saved preset "${name}"`);
        setNewPresetName('');
        setSaveModalOpen(false);
        loadPresetsData();
        setActivePresetId(preset.id);
      } catch (error) {
        toast.error('Failed to save preset');
      } finally {
        setSaving(false);
      }
    },
    [page, newPresetName, currentFilters, loadPresetsData]
  );

  // Handle load preset
  const handleLoadPreset = useCallback(
    presetId => {
      const preset = presets.find(p => p.id === presetId);
      if (!preset) return;

      setActivePresetId(presetId);
      setDropdownOpen(false);
      onLoadPreset(preset.filters);
      toast.success(`Loaded preset "${preset.name}"`);
    },
    [presets, onLoadPreset]
  );

  // Handle delete preset
  const handleDeletePreset = useCallback(
    (e, presetId) => {
      e.stopPropagation();

      const preset = presets.find(p => p.id === presetId);
      if (!preset) return;

      if (confirm(`Delete preset "${preset.name}"?`)) {
        const success = deletePreset(page, presetId);
        if (success) {
          toast.success(`Deleted preset "${preset.name}"`);
          if (activePresetId === presetId) {
            setActivePresetId(null);
          }
          loadPresetsData();
        } else {
          toast.error('Failed to delete preset');
        }
      }
    },
    [page, presets, activePresetId, loadPresetsData]
  );

  // Handle rename preset
  const handleStartRename = useCallback((e, preset) => {
    e.stopPropagation();
    setEditingId(preset.id);
    setEditName(preset.name);
  }, []);

  const handleSaveRename = useCallback(
    (e, presetId) => {
      e.stopPropagation();

      const name = editName.trim();
      if (!name) {
        toast.error('Preset name cannot be empty');
        return;
      }

      if (presetNameExists(page, name, presetId)) {
        toast.error('A preset with this name already exists');
        return;
      }

      const success = renamePreset(page, presetId, name);
      if (success) {
        toast.success('Preset renamed');
        setEditingId(null);
        setEditName('');
        loadPresetsData();
      } else {
        toast.error('Failed to rename preset');
      }
    },
    [page, editName, loadPresetsData]
  );

  const handleCancelRename = useCallback(e => {
    e.stopPropagation();
    setEditingId(null);
    setEditName('');
  }, []);

  // Handle set default
  const handleToggleDefault = useCallback(
    (e, presetId) => {
      e.stopPropagation();

      const preset = presets.find(p => p.id === presetId);
      if (!preset) return;

      // If already default, clear it
      const newDefaultId = preset.isDefault ? null : presetId;

      const success = setDefaultPreset(page, newDefaultId);
      if (success) {
        if (newDefaultId) {
          toast.success(`Set "${preset.name}" as default`);
        } else {
          toast.success('Cleared default preset');
        }
        loadPresetsData();
      } else {
        toast.error('Failed to update default preset');
      }
    },
    [page, presets, loadPresetsData]
  );

  // Handle clear active preset
  const handleClearActive = useCallback(() => {
    setActivePresetId(null);
    setDropdownOpen(false);
    onClearFilters();
  }, [onClearFilters]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;

    function handleClickOutside(e) {
      if (!e.target.closest('[data-preset-dropdown]')) {
        setDropdownOpen(false);
      }
    }

    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [dropdownOpen]);

  const activePreset = presets.find(p => p.id === activePresetId);

  return (
    <div className="flex items-center gap-2">
      {/* Save Preset Button */}
      <button
        type="button"
        onClick={() => setSaveModalOpen(true)}
        className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition"
        aria-label="Save current filters as preset"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Save preset</span>
      </button>

      {/* Presets Dropdown */}
      {presets.length > 0 && (
        <div className="relative" data-preset-dropdown>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition ${
              activePreset
                ? 'border-primary/60 bg-primary/5 text-primary'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
          >
            <span className="max-w-[120px] truncate">
              {activePreset ? activePreset.name : 'Load preset'}
            </span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 z-20 mt-2 w-72 rounded-md border border-slate-200 bg-white p-2 shadow-lg animate-slide-in-from-right">
              <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Saved Presets
              </div>

              {presets.map(preset => (
                <div
                  key={preset.id}
                  className={`group rounded-md px-2 py-2 ${
                    activePresetId === preset.id ? 'bg-primary/10' : 'hover:bg-slate-50'
                  }`}
                >
                  {editingId === preset.id ? (
                    // Edit mode
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveRename(e, preset.id);
                          if (e.key === 'Escape') handleCancelRename(e);
                        }}
                        className="flex-1 h-7 text-sm"
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                      <button
                        onClick={e => handleSaveRename(e, preset.id)}
                        className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                        aria-label="Save"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleCancelRename}
                        className="rounded p-1 text-slate-600 hover:bg-slate-100"
                        aria-label="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    // Normal mode
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLoadPreset(preset.id)}
                        className="flex-1 flex items-center gap-2 min-w-0 text-left"
                      >
                        <span className="flex-1 truncate text-sm text-slate-900">
                          {preset.name}
                        </span>
                        {preset.isDefault && (
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" aria-label="Default preset" />
                        )}
                      </button>

                      {/* Action buttons (visible on hover) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => handleToggleDefault(e, preset.id)}
                          className={`rounded p-1 transition ${
                            preset.isDefault
                              ? 'text-amber-500 hover:bg-amber-50'
                              : 'text-slate-400 hover:bg-slate-100 hover:text-amber-500'
                          }`}
                          title={preset.isDefault ? 'Remove default' : 'Set as default'}
                          aria-label={preset.isDefault ? 'Remove default' : 'Set as default'}
                        >
                          <Star className={`h-3.5 w-3.5 ${preset.isDefault ? 'fill-amber-500' : ''}`} />
                        </button>
                        <button
                          onClick={e => handleStartRename(e, preset)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          aria-label="Rename preset"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={e => handleDeletePreset(e, preset.id)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete preset"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {activePreset && (
                <div className="mt-2 border-t border-slate-200 pt-2">
                  <button
                    onClick={handleClearActive}
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Clear preset & filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Save Modal */}
      {saveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in"
          onClick={() => !saving && setSaveModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl animate-slide-in-from-top"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Save Filter Preset
            </h3>
            <form onSubmit={handleSavePreset}>
              <div className="mb-4">
                <label htmlFor="preset-name" className="block text-sm font-medium text-slate-700 mb-2">
                  Preset Name
                </label>
                <Input
                  id="preset-name"
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  placeholder="e.g., Active products only"
                  disabled={saving}
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSaveModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !newPresetName.trim()}>
                  {saving ? 'Saving...' : 'Save Preset'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
