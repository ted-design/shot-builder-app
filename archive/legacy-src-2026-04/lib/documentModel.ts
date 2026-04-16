/**
 * Document Composition Model for Shot PDF Exports
 *
 * This module defines the hierarchical structure of export documents,
 * ensuring each element renders exactly once at the appropriate level.
 *
 * Document Structure:
 * ┌─────────────────────────────────────┐
 * │ DocumentHeader                      │
 * │   - title, subtitle, timestamp      │
 * ├─────────────────────────────────────┤
 * │ GlobalSummaries                     │
 * │   - laneSummary (once per document) │
 * │   - talentSummary (once per doc)    │
 * ├─────────────────────────────────────┤
 * │ LaneSection (repeated per lane)     │
 * │   - laneHeading                     │
 * │   ├── ShotBlock (repeated)          │
 * │   ├── ShotBlock                     │
 * │   └── ...                           │
 * └─────────────────────────────────────┘
 */

// ============================================================================
// Document Section Types
// ============================================================================

/**
 * Top-level document sections
 */
export type DocumentSectionType =
  | 'header'
  | 'summaries'
  | 'shots';

/**
 * Summary types that appear once per document
 */
export type SummaryType =
  | 'laneSummary'
  | 'talentSummary';

/**
 * Shot field types that appear within each shot block
 */
export type ShotFieldType =
  | 'image'
  | 'shotNumber'
  | 'shotName'
  | 'shotType'
  | 'date'
  | 'location'
  | 'talent'
  | 'products'
  | 'notes';

// ============================================================================
// Section Configuration
// ============================================================================

export interface DocumentSectionConfig {
  id: DocumentSectionType;
  label: string;
  description: string;
  order: number;
}

export interface SummaryConfig {
  id: SummaryType;
  label: string;
  description: string;
  defaultVisible: boolean;
}

export interface ShotFieldConfig {
  id: ShotFieldType;
  label: string;
  description: string;
  defaultVisible: boolean;
  flex: number;
}

// ============================================================================
// Section Configurations
// ============================================================================

/**
 * Document-level sections (for UI grouping)
 */
export const DOCUMENT_SECTIONS: Record<DocumentSectionType, DocumentSectionConfig> = {
  header: {
    id: 'header',
    label: 'Document',
    description: 'Page title, subtitle, and orientation',
    order: 0,
  },
  summaries: {
    id: 'summaries',
    label: 'Summaries',
    description: 'Lane and talent summary tables',
    order: 1,
  },
  shots: {
    id: 'shots',
    label: 'Shots',
    description: 'Shot cards or table with field selection',
    order: 2,
  },
};

/**
 * Summary configurations (global, rendered once per document)
 */
export const SUMMARY_CONFIGS: Record<SummaryType, SummaryConfig> = {
  laneSummary: {
    id: 'laneSummary',
    label: 'Lane Summary',
    description: 'Overview table showing shots per lane',
    defaultVisible: true,
  },
  talentSummary: {
    id: 'talentSummary',
    label: 'Talent Summary',
    description: 'Matrix showing talent assignments across lanes',
    defaultVisible: true,
  },
};

/**
 * Shot field configurations (rendered within each shot block)
 */
export const SHOT_FIELD_CONFIGS: Record<ShotFieldType, ShotFieldConfig> = {
  image: {
    id: 'image',
    label: 'Shot Image',
    description: 'Reference image for shot',
    defaultVisible: true,
    flex: 1,
  },
  shotNumber: {
    id: 'shotNumber',
    label: 'Shot Number',
    description: 'Shot identifier/number',
    defaultVisible: true,
    flex: 0.8,
  },
  shotName: {
    id: 'shotName',
    label: 'Shot Title',
    description: 'Shot name/title',
    defaultVisible: true,
    flex: 2,
  },
  shotType: {
    id: 'shotType',
    label: 'Description',
    description: 'Type or category of shot',
    defaultVisible: true,
    flex: 1,
  },
  date: {
    id: 'date',
    label: 'Date',
    description: 'Shoot date',
    defaultVisible: true,
    flex: 1,
  },
  location: {
    id: 'location',
    label: 'Location',
    description: 'Shooting location',
    defaultVisible: true,
    flex: 1.5,
  },
  talent: {
    id: 'talent',
    label: 'Talent',
    description: 'Assigned talent/models',
    defaultVisible: true,
    flex: 1.5,
  },
  products: {
    id: 'products',
    label: 'Products',
    description: 'Featured products',
    defaultVisible: true,
    flex: 1.5,
  },
  notes: {
    id: 'notes',
    label: 'Notes',
    description: 'Additional shot notes',
    defaultVisible: true,
    flex: 2,
  },
};

// ============================================================================
// Document State Types
// ============================================================================

/**
 * State for document header section
 */
export interface DocumentHeaderState {
  title: string;
  subtitle: string;
  orientation: 'portrait' | 'landscape';
  showTimestamp: boolean;
}

/**
 * State for global summaries section
 */
export interface GlobalSummariesState {
  laneSummary: {
    visible: boolean;
  };
  talentSummary: {
    visible: boolean;
  };
}

/**
 * State for individual shot field
 */
export interface ShotFieldState {
  visible: boolean;
  flex: number;
  customLabel?: string;
}

/**
 * State for shots section
 */
export interface ShotsState {
  layoutMode: 'table' | 'gallery';
  density: 'compact' | 'standard' | 'detailed';
  galleryColumns: number;
  fields: Record<ShotFieldType, ShotFieldState>;
  imageSettings: {
    includeImages: boolean;
    fallbackToProductImages: boolean;
    inlineImages: boolean;
  };
}

/**
 * Complete document export state
 */
export interface DocumentExportState {
  header: DocumentHeaderState;
  summaries: GlobalSummariesState;
  shots: ShotsState;
}

// ============================================================================
// Default State Factories
// ============================================================================

/**
 * Create default document header state
 */
export function createDefaultHeaderState(projectName?: string): DocumentHeaderState {
  return {
    title: projectName || 'Planner export',
    subtitle: '',
    orientation: 'portrait',
    showTimestamp: true,
  };
}

/**
 * Create default global summaries state
 */
export function createDefaultSummariesState(): GlobalSummariesState {
  return {
    laneSummary: {
      visible: SUMMARY_CONFIGS.laneSummary.defaultVisible,
    },
    talentSummary: {
      visible: SUMMARY_CONFIGS.talentSummary.defaultVisible,
    },
  };
}

/**
 * Create default shot field state
 */
export function createDefaultFieldState(fieldId: ShotFieldType): ShotFieldState {
  const config = SHOT_FIELD_CONFIGS[fieldId];
  return {
    visible: config.defaultVisible,
    flex: config.flex,
  };
}

/**
 * Create default shots state
 */
export function createDefaultShotsState(): ShotsState {
  const fields = {} as Record<ShotFieldType, ShotFieldState>;

  (Object.keys(SHOT_FIELD_CONFIGS) as ShotFieldType[]).forEach((fieldId) => {
    fields[fieldId] = createDefaultFieldState(fieldId);
  });

  return {
    layoutMode: 'table',
    density: 'standard',
    galleryColumns: 3,
    fields,
    imageSettings: {
      includeImages: true,
      fallbackToProductImages: true,
      inlineImages: true,
    },
  };
}

/**
 * Create complete default document export state
 */
export function createDefaultDocumentState(projectName?: string): DocumentExportState {
  return {
    header: createDefaultHeaderState(projectName),
    summaries: createDefaultSummariesState(),
    shots: createDefaultShotsState(),
  };
}

// ============================================================================
// State Conversion Utilities (for backward compatibility)
// ============================================================================

/**
 * Convert legacy flat export options to document state
 */
export function legacyOptionsToDocumentState(options: {
  title?: string;
  subtitle?: string;
  orientation?: string;
  includeLaneSummary?: boolean;
  includeTalentSummary?: boolean;
  layout?: string;
  density?: string;
  galleryColumns?: number | string;
  fields?: Record<string, boolean>;
  includeImages?: boolean;
  fallbackToProductImages?: boolean;
  inlineImages?: boolean;
}): DocumentExportState {
  const state = createDefaultDocumentState(options.title);

  // Header
  state.header.title = options.title || state.header.title;
  state.header.subtitle = options.subtitle || '';
  state.header.orientation = (options.orientation as 'portrait' | 'landscape') || 'portrait';

  // Summaries
  state.summaries.laneSummary.visible = options.includeLaneSummary ?? true;
  state.summaries.talentSummary.visible = options.includeTalentSummary ?? true;

  // Shots
  state.shots.layoutMode = (options.layout as 'table' | 'gallery') || 'table';
  state.shots.density = (options.density as 'compact' | 'standard' | 'detailed') || 'standard';
  state.shots.galleryColumns = typeof options.galleryColumns === 'number'
    ? options.galleryColumns
    : parseInt(String(options.galleryColumns), 10) || 3;

  // Field visibility
  if (options.fields) {
    (Object.keys(options.fields) as ShotFieldType[]).forEach((fieldId) => {
      if (state.shots.fields[fieldId]) {
        state.shots.fields[fieldId].visible = options.fields![fieldId] ?? true;
      }
    });
  }

  // Image settings
  state.shots.imageSettings.includeImages = options.includeImages ?? true;
  state.shots.imageSettings.fallbackToProductImages = options.fallbackToProductImages ?? true;
  state.shots.imageSettings.inlineImages = options.inlineImages ?? true;

  return state;
}

/**
 * Convert document state back to legacy export options
 */
export function documentStateToLegacyOptions(state: DocumentExportState): {
  title: string;
  subtitle: string;
  orientation: string;
  includeLaneSummary: boolean;
  includeTalentSummary: boolean;
  layout: string;
  density: string;
  galleryColumns: number;
  fields: Record<string, boolean>;
  includeImages: boolean;
  fallbackToProductImages: boolean;
  inlineImages: boolean;
} {
  const fields: Record<string, boolean> = {};

  (Object.keys(state.shots.fields) as ShotFieldType[]).forEach((fieldId) => {
    fields[fieldId] = state.shots.fields[fieldId].visible;
  });

  return {
    title: state.header.title,
    subtitle: state.header.subtitle,
    orientation: state.header.orientation,
    includeLaneSummary: state.summaries.laneSummary.visible,
    includeTalentSummary: state.summaries.talentSummary.visible,
    layout: state.shots.layoutMode,
    density: state.shots.density,
    galleryColumns: state.shots.galleryColumns,
    fields,
    includeImages: state.shots.imageSettings.includeImages,
    fallbackToProductImages: state.shots.imageSettings.fallbackToProductImages,
    inlineImages: state.shots.imageSettings.inlineImages,
  };
}

// ============================================================================
// Section Helpers
// ============================================================================

/**
 * Get ordered list of document sections for UI rendering
 */
export function getOrderedDocumentSections(): DocumentSectionConfig[] {
  return Object.values(DOCUMENT_SECTIONS).sort((a, b) => a.order - b.order);
}

/**
 * Get visible shot fields sorted by order
 */
export function getVisibleShotFields(shotsState: ShotsState): ShotFieldType[] {
  return (Object.keys(shotsState.fields) as ShotFieldType[])
    .filter((fieldId) => shotsState.fields[fieldId].visible);
}

/**
 * Check if any summaries are enabled
 */
export function hasSummariesEnabled(summariesState: GlobalSummariesState): boolean {
  return summariesState.laneSummary.visible || summariesState.talentSummary.visible;
}
