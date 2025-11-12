// src/lib/plannerSheetSections.js
//
// Configuration for planner sheet sections and layout options
// Used by the WYSIWYG planner sheet builder

import {
  FileText,
  Image,
  Hash,
  Calendar,
  MapPin,
  Users,
  Package,
  FileEdit,
  Tag,
  LayoutGrid,
} from 'lucide-react';

/**
 * Section types available in planner sheets
 */
export const SECTION_TYPES = {
  HEADER: 'header',
  IMAGE: 'image',
  SHOT_NUMBER: 'shotNumber',
  SHOT_NAME: 'shotName',
  SHOT_TYPE: 'shotType',
  DATE: 'date',
  LOCATION: 'location',
  TALENT: 'talent',
  PRODUCTS: 'products',
  NOTES: 'notes',
};

/**
 * Section configuration with metadata
 */
export const SECTION_CONFIG = {
  [SECTION_TYPES.HEADER]: {
    id: SECTION_TYPES.HEADER,
    label: 'Header Section',
    description: 'Document title and subtitle',
    icon: FileText,
    defaultVisible: true,
    required: false,
    order: 0,
    category: 'document',
    settings: {
      headerText: '',
      subheaderText: '',
    },
  },
  [SECTION_TYPES.IMAGE]: {
    id: SECTION_TYPES.IMAGE,
    label: 'Shot Image',
    description: 'Reference image for shot',
    icon: Image,
    defaultVisible: false,
    required: false,
    order: 1,
    category: 'columns',
    fieldKey: 'image',
    flex: 1,
  },
  [SECTION_TYPES.SHOT_NUMBER]: {
    id: SECTION_TYPES.SHOT_NUMBER,
    label: 'Shot Number',
    description: 'Shot identifier/number',
    icon: Hash,
    defaultVisible: true,
    required: true,
    order: 2,
    category: 'columns',
    fieldKey: 'shotNumber',
    flex: 0.8,
  },
  [SECTION_TYPES.SHOT_NAME]: {
    id: SECTION_TYPES.SHOT_NAME,
    label: 'Shot Title',
    description: 'Shot name/title',
    icon: Tag,
    defaultVisible: true,
    required: true,
    order: 3,
    category: 'columns',
    fieldKey: 'name',
    flex: 2,
  },
  [SECTION_TYPES.SHOT_TYPE]: {
    id: SECTION_TYPES.SHOT_TYPE,
    label: 'Shot Type',
    description: 'Type or category of shot',
    icon: LayoutGrid,
    defaultVisible: true,
    required: false,
    order: 4,
    category: 'columns',
    fieldKey: 'type',
    flex: 1,
  },
  [SECTION_TYPES.DATE]: {
    id: SECTION_TYPES.DATE,
    label: 'Date',
    description: 'Shoot date',
    icon: Calendar,
    defaultVisible: true,
    required: false,
    order: 5,
    category: 'columns',
    fieldKey: 'date',
    flex: 1,
  },
  [SECTION_TYPES.LOCATION]: {
    id: SECTION_TYPES.LOCATION,
    label: 'Location',
    description: 'Shooting location',
    icon: MapPin,
    defaultVisible: true,
    required: false,
    order: 6,
    category: 'columns',
    fieldKey: 'location',
    flex: 1.5,
  },
  [SECTION_TYPES.TALENT]: {
    id: SECTION_TYPES.TALENT,
    label: 'Talent',
    description: 'Assigned talent/models',
    icon: Users,
    defaultVisible: true,
    required: false,
    order: 7,
    category: 'columns',
    fieldKey: 'talent',
    flex: 1.5,
  },
  [SECTION_TYPES.PRODUCTS]: {
    id: SECTION_TYPES.PRODUCTS,
    label: 'Products',
    description: 'Featured products',
    icon: Package,
    defaultVisible: true,
    required: false,
    order: 8,
    category: 'columns',
    fieldKey: 'products',
    flex: 1.5,
  },
  [SECTION_TYPES.NOTES]: {
    id: SECTION_TYPES.NOTES,
    label: 'Notes',
    description: 'Additional shot notes',
    icon: FileEdit,
    defaultVisible: true,
    required: false,
    order: 9,
    category: 'columns',
    fieldKey: 'notes',
    flex: 2,
  },
};

/**
 * Layout presets for quick configuration
 */
export const LAYOUT_PRESETS = {
  STANDARD: {
    id: 'standard',
    name: 'Standard',
    description: 'All columns with images',
    icon: LayoutGrid,
    sections: {
      [SECTION_TYPES.HEADER]: { visible: true },
      [SECTION_TYPES.IMAGE]: { visible: true },
      [SECTION_TYPES.SHOT_NUMBER]: { visible: true },
      [SECTION_TYPES.SHOT_NAME]: { visible: true },
      [SECTION_TYPES.SHOT_TYPE]: { visible: true },
      [SECTION_TYPES.DATE]: { visible: true },
      [SECTION_TYPES.LOCATION]: { visible: true },
      [SECTION_TYPES.TALENT]: { visible: true },
      [SECTION_TYPES.PRODUCTS]: { visible: true },
      [SECTION_TYPES.NOTES]: { visible: true },
    },
  },
  MINIMAL: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Essential columns only, no images',
    icon: LayoutGrid,
    sections: {
      [SECTION_TYPES.HEADER]: { visible: false },
      [SECTION_TYPES.IMAGE]: { visible: false },
      [SECTION_TYPES.SHOT_NUMBER]: { visible: true },
      [SECTION_TYPES.SHOT_NAME]: { visible: true },
      [SECTION_TYPES.SHOT_TYPE]: { visible: true },
      [SECTION_TYPES.DATE]: { visible: true },
      [SECTION_TYPES.LOCATION]: { visible: false },
      [SECTION_TYPES.TALENT]: { visible: true },
      [SECTION_TYPES.PRODUCTS]: { visible: false },
      [SECTION_TYPES.NOTES]: { visible: false },
    },
  },
  GALLERY_OPTIMIZED: {
    id: 'gallery',
    name: 'Gallery Optimized',
    description: 'Compact layout for multi-column display',
    icon: LayoutGrid,
    sections: {
      [SECTION_TYPES.HEADER]: { visible: true },
      [SECTION_TYPES.IMAGE]: { visible: true },
      [SECTION_TYPES.SHOT_NUMBER]: { visible: true },
      [SECTION_TYPES.SHOT_NAME]: { visible: true },
      [SECTION_TYPES.SHOT_TYPE]: { visible: false },
      [SECTION_TYPES.DATE]: { visible: false },
      [SECTION_TYPES.LOCATION]: { visible: true },
      [SECTION_TYPES.TALENT]: { visible: true },
      [SECTION_TYPES.PRODUCTS]: { visible: true },
      [SECTION_TYPES.NOTES]: { visible: false },
    },
  },
  PRINT_FRIENDLY: {
    id: 'print',
    name: 'Print Friendly',
    description: 'Essential fields for warehouse use',
    icon: LayoutGrid,
    sections: {
      [SECTION_TYPES.HEADER]: { visible: true },
      [SECTION_TYPES.IMAGE]: { visible: false },
      [SECTION_TYPES.SHOT_NUMBER]: { visible: true },
      [SECTION_TYPES.SHOT_NAME]: { visible: true },
      [SECTION_TYPES.SHOT_TYPE]: { visible: true },
      [SECTION_TYPES.DATE]: { visible: true },
      [SECTION_TYPES.LOCATION]: { visible: true },
      [SECTION_TYPES.TALENT]: { visible: true },
      [SECTION_TYPES.PRODUCTS]: { visible: true },
      [SECTION_TYPES.NOTES]: { visible: false },
    },
  },
};

/**
 * Get default section configuration
 */
export function getDefaultSectionConfig() {
  return Object.values(SECTION_CONFIG).reduce((acc, section) => {
    acc[section.id] = {
      visible: section.defaultVisible,
      order: section.order,
      flex: section.flex,
    };
    return acc;
  }, {});
}

/**
 * Get sections sorted by order
 */
export function getSortedSections(sectionConfig = SECTION_CONFIG) {
  return Object.values(sectionConfig).sort((a, b) => a.order - b.order);
}

/**
 * Get visible sections only
 */
export function getVisibleSections(sectionStates) {
  return getSortedSections()
    .filter(section => sectionStates[section.id]?.visible !== false);
}

/**
 * Get column sections (excluding header)
 */
export function getColumnSections() {
  return Object.values(SECTION_CONFIG)
    .filter(section => section.category === 'columns')
    .sort((a, b) => a.order - b.order);
}

/**
 * Convert section configuration to PlannerExportModal field format
 * Maps new section states to the existing fields object
 */
export function sectionConfigToExportSettings(sectionStates) {
  const fields = {};

  Object.entries(sectionStates).forEach(([sectionId, state]) => {
    const section = SECTION_CONFIG[sectionId];
    if (!section || section.category !== 'columns') return;

    // Map section to field key
    if (section.fieldKey) {
      fields[section.fieldKey] = state.visible !== false;
    }
  });

  return { fields };
}

/**
 * Convert PlannerExportModal settings to section configuration
 * Maps existing fields object to new section states
 */
export function exportSettingsToSectionConfig(fields) {
  const sectionStates = getDefaultSectionConfig();

  // Map field keys back to sections
  if (fields) {
    Object.entries(fields).forEach(([fieldKey, visible]) => {
      const section = Object.values(SECTION_CONFIG).find(s => s.fieldKey === fieldKey);
      if (section) {
        sectionStates[section.id].visible = visible;
      }
    });
  }

  return sectionStates;
}

/**
 * Apply a layout preset to section states
 */
export function applyLayoutPreset(presetId) {
  const preset = LAYOUT_PRESETS[presetId];
  if (!preset) {
    console.warn(`[plannerSheetSections] Unknown preset: ${presetId}`);
    return getDefaultSectionConfig();
  }

  const sectionStates = getDefaultSectionConfig();

  Object.entries(preset.sections).forEach(([sectionId, settings]) => {
    if (sectionStates[sectionId]) {
      Object.assign(sectionStates[sectionId], settings);
    }
  });

  return sectionStates;
}

/**
 * Validate section configuration
 */
export function validateSectionConfig(sectionStates) {
  const errors = [];

  // Check that at least one column is visible
  const visibleColumns = getColumnSections().filter(
    section => sectionStates[section.id]?.visible !== false
  );

  if (visibleColumns.length === 0) {
    errors.push('At least one column must be visible');
  }

  // Check that required sections are visible
  Object.values(SECTION_CONFIG).forEach(section => {
    if (section.required && sectionStates[section.id]?.visible === false) {
      errors.push(`Required section "${section.label}" must be visible`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get section state by field key (for backward compatibility)
 */
export function getSectionByFieldKey(fieldKey) {
  return Object.values(SECTION_CONFIG).find(s => s.fieldKey === fieldKey);
}

/**
 * Check if a section is a column type
 */
export function isColumnSection(sectionId) {
  const section = SECTION_CONFIG[sectionId];
  return section?.category === 'columns';
}

/**
 * Get visible field keys (for backward compatibility with existing code)
 */
export function getVisibleFieldKeys(sectionStates) {
  const fields = {};

  Object.entries(sectionStates).forEach(([sectionId, state]) => {
    const section = SECTION_CONFIG[sectionId];
    if (section?.fieldKey && state.visible !== false) {
      fields[section.fieldKey] = true;
    }
  });

  return fields;
}
