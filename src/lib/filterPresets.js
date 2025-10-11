/**
 * Filter preset management utilities
 * Save, load, and manage filter combinations for different pages
 */

import { readStorage, writeStorage } from './safeStorage';

/**
 * Generate a unique ID for presets
 * @returns {string} Unique preset ID
 */
function generatePresetId() {
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Get storage key for a page's presets
 * @param {string} page - Page name (e.g., 'shots', 'products')
 * @returns {string} Storage key
 */
function getStorageKey(page) {
  return `filterPresets:${page}`;
}

/**
 * Get all presets for a page
 * @param {string} page - Page name
 * @returns {Array} Array of preset objects
 */
export function listPresets(page) {
  try {
    const key = getStorageKey(page);
    const stored = readStorage(key);
    if (!stored) return [];

    const presets = JSON.parse(stored);
    return Array.isArray(presets) ? presets : [];
  } catch (error) {
    console.warn(`[FilterPresets] Failed to list presets for ${page}:`, error);
    return [];
  }
}

/**
 * Save a new filter preset
 * @param {string} page - Page name
 * @param {string} name - Preset name
 * @param {Object} filters - Filter configuration to save
 * @param {Object} options - Additional options
 * @returns {Object} Created preset
 */
export function savePreset(page, name, filters, options = {}) {
  try {
    const presets = listPresets(page);

    const newPreset = {
      id: generatePresetId(),
      name: name.trim(),
      filters: { ...filters },
      createdAt: Date.now(),
      isDefault: options.isDefault || false,
    };

    // If this is set as default, unset all other defaults
    if (newPreset.isDefault) {
      presets.forEach(preset => {
        preset.isDefault = false;
      });
    }

    presets.push(newPreset);

    const key = getStorageKey(page);
    writeStorage(key, JSON.stringify(presets));

    return newPreset;
  } catch (error) {
    console.error(`[FilterPresets] Failed to save preset for ${page}:`, error);

    // Handle specific quota exceeded error
    if (error.name === 'QuotaExceededError') {
      throw new Error('Storage quota exceeded. Please delete some presets to free up space.');
    }

    throw new Error('Failed to save filter preset');
  }
}

/**
 * Load a filter preset by ID
 * @param {string} page - Page name
 * @param {string} presetId - Preset ID to load
 * @returns {Object|null} Preset object or null if not found
 */
export function loadPreset(page, presetId) {
  try {
    const presets = listPresets(page);
    return presets.find(preset => preset.id === presetId) || null;
  } catch (error) {
    console.error(`[FilterPresets] Failed to load preset ${presetId}:`, error);
    return null;
  }
}

/**
 * Delete a filter preset
 * @param {string} page - Page name
 * @param {string} presetId - Preset ID to delete
 * @returns {boolean} True if deleted successfully
 */
export function deletePreset(page, presetId) {
  try {
    const presets = listPresets(page);
    const filtered = presets.filter(preset => preset.id !== presetId);

    if (filtered.length === presets.length) {
      // Preset not found
      return false;
    }

    const key = getStorageKey(page);
    writeStorage(key, JSON.stringify(filtered));

    return true;
  } catch (error) {
    console.error(`[FilterPresets] Failed to delete preset ${presetId}:`, error);
    return false;
  }
}

/**
 * Rename a filter preset
 * @param {string} page - Page name
 * @param {string} presetId - Preset ID to rename
 * @param {string} newName - New name for the preset
 * @returns {boolean} True if renamed successfully
 */
export function renamePreset(page, presetId, newName) {
  try {
    const presets = listPresets(page);
    const preset = presets.find(p => p.id === presetId);

    if (!preset) {
      return false;
    }

    preset.name = newName.trim();

    const key = getStorageKey(page);
    writeStorage(key, JSON.stringify(presets));

    return true;
  } catch (error) {
    console.error(`[FilterPresets] Failed to rename preset ${presetId}:`, error);
    return false;
  }
}

/**
 * Set a preset as the default for a page
 * @param {string} page - Page name
 * @param {string} presetId - Preset ID to set as default (null to clear default)
 * @returns {boolean} True if set successfully
 */
export function setDefaultPreset(page, presetId) {
  try {
    const presets = listPresets(page);

    // Clear all defaults
    presets.forEach(preset => {
      preset.isDefault = false;
    });

    // Set new default if presetId provided
    if (presetId) {
      const preset = presets.find(p => p.id === presetId);
      if (!preset) {
        return false;
      }
      preset.isDefault = true;
    }

    const key = getStorageKey(page);
    writeStorage(key, JSON.stringify(presets));

    return true;
  } catch (error) {
    console.error(`[FilterPresets] Failed to set default preset:`, error);
    return false;
  }
}

/**
 * Get the default preset for a page
 * @param {string} page - Page name
 * @returns {Object|null} Default preset or null
 */
export function getDefaultPreset(page) {
  try {
    const presets = listPresets(page);
    return presets.find(preset => preset.isDefault) || null;
  } catch (error) {
    console.error(`[FilterPresets] Failed to get default preset:`, error);
    return null;
  }
}

/**
 * Update a preset's filters
 * @param {string} page - Page name
 * @param {string} presetId - Preset ID to update
 * @param {Object} filters - New filter configuration
 * @returns {boolean} True if updated successfully
 */
export function updatePresetFilters(page, presetId, filters) {
  try {
    const presets = listPresets(page);
    const preset = presets.find(p => p.id === presetId);

    if (!preset) {
      return false;
    }

    preset.filters = { ...filters };

    const key = getStorageKey(page);
    writeStorage(key, JSON.stringify(presets));

    return true;
  } catch (error) {
    console.error(`[FilterPresets] Failed to update preset ${presetId}:`, error);
    return false;
  }
}

/**
 * Check if a preset name already exists for a page
 * @param {string} page - Page name
 * @param {string} name - Preset name to check
 * @param {string} excludeId - Preset ID to exclude from check (for renaming)
 * @returns {boolean} True if name exists
 */
export function presetNameExists(page, name, excludeId = null) {
  try {
    const presets = listPresets(page);
    const normalizedName = name.trim().toLowerCase();

    return presets.some(
      preset =>
        preset.id !== excludeId &&
        preset.name.toLowerCase() === normalizedName
    );
  } catch (error) {
    console.error(`[FilterPresets] Failed to check preset name:`, error);
    return false;
  }
}

/**
 * Clear all presets for a page
 * @param {string} page - Page name
 * @returns {boolean} True if cleared successfully
 */
export function clearAllPresets(page) {
  try {
    const key = getStorageKey(page);
    writeStorage(key, JSON.stringify([]));
    return true;
  } catch (error) {
    console.error(`[FilterPresets] Failed to clear presets:`, error);
    return false;
  }
}

/**
 * Export presets for a page as JSON
 * Useful for backup or sharing
 * @param {string} page - Page name
 * @returns {string} JSON string of presets
 */
export function exportPresets(page) {
  try {
    const presets = listPresets(page);
    return JSON.stringify(presets, null, 2);
  } catch (error) {
    console.error(`[FilterPresets] Failed to export presets:`, error);
    return '[]';
  }
}

/**
 * Import presets for a page from JSON
 * @param {string} page - Page name
 * @param {string} json - JSON string of presets
 * @param {boolean} merge - If true, merge with existing presets. If false, replace.
 * @returns {number} Number of presets imported
 */
export function importPresets(page, json, merge = false) {
  try {
    const imported = JSON.parse(json);
    if (!Array.isArray(imported)) {
      throw new Error('Invalid preset format');
    }

    const existing = merge ? listPresets(page) : [];
    const combined = [...existing, ...imported];

    const key = getStorageKey(page);
    writeStorage(key, JSON.stringify(combined));

    return imported.length;
  } catch (error) {
    console.error(`[FilterPresets] Failed to import presets:`, error);
    throw new Error('Failed to import presets: ' + error.message);
  }
}
