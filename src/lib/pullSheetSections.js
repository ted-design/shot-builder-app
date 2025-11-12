// src/lib/pullSheetSections.js
//
// Configuration for pull sheet sections and layout options
// Used by the WYSIWYG pull sheet builder

import {
  FileText,
  Image,
  Package,
  Hash,
  Palette,
  Users,
  Ruler,
  Hash as Quantity,
  CheckCircle,
  FileEdit,
  LayoutGrid,
} from 'lucide-react';

/**
 * Section types available in pull sheets
 */
export const SECTION_TYPES = {
  HEADER: 'header',
  IMAGES: 'images',
  PRODUCT: 'product',
  STYLE_NUMBER: 'styleNumber',
  COLOUR: 'colour',
  GENDER: 'gender',
  SIZE: 'size',
  QUANTITY: 'quantity',
  FULFILLED: 'fulfilled',
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
  [SECTION_TYPES.IMAGES]: {
    id: SECTION_TYPES.IMAGES,
    label: 'Product Images',
    description: 'Visual reference images for items',
    icon: Image,
    defaultVisible: true,
    required: false,
    order: 1,
    category: 'columns',
    columnKey: 'image',
    flex: 0.7,
  },
  [SECTION_TYPES.PRODUCT]: {
    id: SECTION_TYPES.PRODUCT,
    label: 'Product Name',
    description: 'Product family name',
    icon: Package,
    defaultVisible: true,
    required: true,
    order: 2,
    category: 'columns',
    columnKey: 'product',
    flex: 2,
  },
  [SECTION_TYPES.STYLE_NUMBER]: {
    id: SECTION_TYPES.STYLE_NUMBER,
    label: 'Style Number',
    description: 'Product style/SKU identifier',
    icon: Hash,
    defaultVisible: true,
    required: false,
    order: 3,
    category: 'columns',
    columnKey: 'styleNumber',
    flex: 1,
  },
  [SECTION_TYPES.COLOUR]: {
    id: SECTION_TYPES.COLOUR,
    label: 'Colour',
    description: 'Product color/variant',
    icon: Palette,
    defaultVisible: true,
    required: false,
    order: 4,
    category: 'columns',
    columnKey: 'colour',
    flex: 1,
  },
  [SECTION_TYPES.GENDER]: {
    id: SECTION_TYPES.GENDER,
    label: 'Gender',
    description: 'Target gender category',
    icon: Users,
    defaultVisible: true,
    required: false,
    order: 5,
    category: 'columns',
    columnKey: 'gender',
    flex: 0.8,
  },
  [SECTION_TYPES.SIZE]: {
    id: SECTION_TYPES.SIZE,
    label: 'Size',
    description: 'Product size information',
    icon: Ruler,
    defaultVisible: true,
    required: false,
    order: 6,
    category: 'columns',
    columnKey: 'size',
    flex: 0.7,
  },
  [SECTION_TYPES.QUANTITY]: {
    id: SECTION_TYPES.QUANTITY,
    label: 'Quantity Requested',
    description: 'Number of items requested',
    icon: Quantity,
    defaultVisible: true,
    required: true,
    order: 7,
    category: 'columns',
    columnKey: 'quantity',
    flex: 0.7,
  },
  [SECTION_TYPES.FULFILLED]: {
    id: SECTION_TYPES.FULFILLED,
    label: 'Quantity Fulfilled',
    description: 'Number of items fulfilled',
    icon: CheckCircle,
    defaultVisible: true,
    required: false,
    order: 8,
    category: 'columns',
    columnKey: 'fulfilled',
    flex: 0.9,
  },
  [SECTION_TYPES.NOTES]: {
    id: SECTION_TYPES.NOTES,
    label: 'Notes',
    description: 'Additional item notes',
    icon: FileEdit,
    defaultVisible: true,
    required: false,
    order: 9,
    category: 'columns',
    columnKey: 'notes',
    flex: 1.5,
  },
};

/**
 * Page break strategies
 */
export const PAGE_BREAK_STRATEGIES = {
  AUTO: 'auto',
  BY_GENDER: 'by-gender',
  BY_CATEGORY: 'by-category',
};

/**
 * Page orientation options
 */
export const ORIENTATIONS = {
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape',
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
    orientation: ORIENTATIONS.PORTRAIT,
    pageBreakStrategy: PAGE_BREAK_STRATEGIES.AUTO,
    sections: {
      [SECTION_TYPES.HEADER]: { visible: true },
      [SECTION_TYPES.IMAGES]: { visible: true },
      [SECTION_TYPES.PRODUCT]: { visible: true },
      [SECTION_TYPES.STYLE_NUMBER]: { visible: true },
      [SECTION_TYPES.COLOUR]: { visible: true },
      [SECTION_TYPES.GENDER]: { visible: true },
      [SECTION_TYPES.SIZE]: { visible: true },
      [SECTION_TYPES.QUANTITY]: { visible: true },
      [SECTION_TYPES.FULFILLED]: { visible: true },
      [SECTION_TYPES.NOTES]: { visible: true },
    },
  },
  MINIMAL: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Essential columns only, no images',
    icon: LayoutGrid,
    orientation: ORIENTATIONS.PORTRAIT,
    pageBreakStrategy: PAGE_BREAK_STRATEGIES.AUTO,
    sections: {
      [SECTION_TYPES.HEADER]: { visible: false },
      [SECTION_TYPES.IMAGES]: { visible: false },
      [SECTION_TYPES.PRODUCT]: { visible: true },
      [SECTION_TYPES.STYLE_NUMBER]: { visible: true },
      [SECTION_TYPES.COLOUR]: { visible: true },
      [SECTION_TYPES.GENDER]: { visible: false },
      [SECTION_TYPES.SIZE]: { visible: true },
      [SECTION_TYPES.QUANTITY]: { visible: true },
      [SECTION_TYPES.FULFILLED]: { visible: true },
      [SECTION_TYPES.NOTES]: { visible: false },
    },
  },
  DETAILED: {
    id: 'detailed',
    name: 'Detailed',
    description: 'All fields with landscape layout',
    icon: LayoutGrid,
    orientation: ORIENTATIONS.LANDSCAPE,
    pageBreakStrategy: PAGE_BREAK_STRATEGIES.BY_GENDER,
    sections: {
      [SECTION_TYPES.HEADER]: { visible: true },
      [SECTION_TYPES.IMAGES]: { visible: true },
      [SECTION_TYPES.PRODUCT]: { visible: true },
      [SECTION_TYPES.STYLE_NUMBER]: { visible: true },
      [SECTION_TYPES.COLOUR]: { visible: true },
      [SECTION_TYPES.GENDER]: { visible: true },
      [SECTION_TYPES.SIZE]: { visible: true },
      [SECTION_TYPES.QUANTITY]: { visible: true },
      [SECTION_TYPES.FULFILLED]: { visible: true },
      [SECTION_TYPES.NOTES]: { visible: true },
    },
  },
  FULFILLMENT: {
    id: 'fulfillment',
    name: 'Fulfillment Focus',
    description: 'Optimized for warehouse picking',
    icon: LayoutGrid,
    orientation: ORIENTATIONS.PORTRAIT,
    pageBreakStrategy: PAGE_BREAK_STRATEGIES.BY_CATEGORY,
    sections: {
      [SECTION_TYPES.HEADER]: { visible: true },
      [SECTION_TYPES.IMAGES]: { visible: true },
      [SECTION_TYPES.PRODUCT]: { visible: true },
      [SECTION_TYPES.STYLE_NUMBER]: { visible: true },
      [SECTION_TYPES.COLOUR]: { visible: true },
      [SECTION_TYPES.GENDER]: { visible: true },
      [SECTION_TYPES.SIZE]: { visible: true },
      [SECTION_TYPES.QUANTITY]: { visible: true },
      [SECTION_TYPES.FULFILLED]: { visible: true },
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
 * Convert section configuration to PullExportModal format
 */
export function sectionConfigToExportSettings(sectionStates, orientation, pageBreakStrategy) {
  const columns = {};
  const columnFlex = {};
  let includeImages = false;

  Object.entries(sectionStates).forEach(([sectionId, state]) => {
    const section = SECTION_CONFIG[sectionId];
    if (!section) return;

    if (section.category === 'columns') {
      if (section.columnKey === 'image') {
        includeImages = state.visible;
      } else {
        columns[section.columnKey] = state.visible;
      }

      if (state.flex !== undefined) {
        columnFlex[section.columnKey || 'image'] = state.flex;
      } else if (section.flex !== undefined) {
        columnFlex[section.columnKey || 'image'] = section.flex;
      }
    }
  });

  return {
    orientation,
    pageBreakStrategy,
    includeImages,
    columns,
    columnFlex,
    repeatHeaderEachPage: true,
    groupHeaderEachSection: true,
  };
}

/**
 * Convert PullExportModal settings to section configuration
 */
export function exportSettingsToSectionConfig(settings) {
  const sectionStates = getDefaultSectionConfig();

  // Handle images
  if (settings.includeImages !== undefined) {
    sectionStates[SECTION_TYPES.IMAGES].visible = settings.includeImages;
  }

  // Handle columns
  if (settings.columns) {
    Object.entries(settings.columns).forEach(([columnKey, visible]) => {
      const section = Object.values(SECTION_CONFIG).find(s => s.columnKey === columnKey);
      if (section) {
        sectionStates[section.id].visible = visible;
      }
    });
  }

  // Handle column flex
  if (settings.columnFlex) {
    Object.entries(settings.columnFlex).forEach(([columnKey, flex]) => {
      const section = Object.values(SECTION_CONFIG).find(
        s => s.columnKey === columnKey || (columnKey === 'image' && s.id === SECTION_TYPES.IMAGES)
      );
      if (section) {
        sectionStates[section.id].flex = flex;
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
    console.warn(`[pullSheetSections] Unknown preset: ${presetId}`);
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
