/**
 * Export Preset Resolver
 *
 * A configuration engine that produces complete, visually-safe export configs
 * from high-level presets. This module ensures that no combination of user
 * choices can result in broken, sparse, or ugly output.
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ User Intent Layer                                                       │
 * │   Document Type → Content Focus → Presentation Style                    │
 * └────────────────────────────────────┬────────────────────────────────────┘
 *                                      │
 *                                      ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Resolver Engine                                                          │
 * │   1. Load baseline from Document Type preset                             │
 * │   2. Apply Content Focus toggles (enable/disable semantic groups)       │
 * │   3. Apply Presentation Style modifiers (density, truncation, emphasis) │
 * │   4. Validate and clamp unsafe combinations                              │
 * │   5. Return complete, render-ready config                               │
 * └────────────────────────────────────┬────────────────────────────────────┘
 *                                      │
 *                                      ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Render-Ready Export Config                                               │
 * │   All fields defined, no invalid combinations, guaranteed visual output  │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Document Type defines the overall purpose and baseline configuration
 */
export type DocumentType =
  | 'clientOverview'     // Polished, shareable with clients
  | 'internalPlanning'   // Detailed for internal production use
  | 'wardrobeStyling'    // Focus on products and wardrobe
  | 'minimal';           // Compact, data-focused

/**
 * Content Focus toggles control which semantic groups are included
 */
export interface ContentFocus {
  includeSummaries: boolean;
  includeProducts: boolean;
  includeNotes: boolean;
}

/**
 * Presentation Style controls density and visual treatment
 */
export type PresentationStyle =
  | 'clean'     // Spacious, emphasis on visuals
  | 'detailed'  // Balanced, all information visible
  | 'compact';  // Dense, data-focused

/**
 * Advanced overrides (collapsed in UI, for power users)
 */
export interface AdvancedOverrides {
  customTitle?: string;
  customSubtitle?: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Input to the resolver
 */
export interface ResolverInput {
  documentType: DocumentType;
  contentFocus: ContentFocus;
  presentationStyle: PresentationStyle;
  advancedOverrides?: AdvancedOverrides;
}

/**
 * Complete, render-ready export configuration
 * Every field is defined and validated
 */
export interface ResolvedExportConfig {
  // Document header
  title: string;
  subtitle: string;
  orientation: 'portrait' | 'landscape';

  // Layout
  layoutMode: 'table' | 'gallery';
  density: 'compact' | 'standard' | 'detailed';
  galleryColumns: number;

  // Summaries (document-level, rendered once)
  includeLaneSummary: boolean;
  includeTalentSummary: boolean;

  // Shot fields visibility
  fields: {
    image: boolean;
    shotNumber: boolean;
    shotName: boolean;
    shotType: boolean;
    date: boolean;
    location: boolean;
    talent: boolean;
    products: boolean;
    notes: boolean;
  };

  // Image settings
  imageSettings: {
    includeImages: boolean;
    fallbackToProductImages: boolean;
    inlineImages: boolean;
    imageProminence: 'large' | 'medium' | 'small' | 'hidden';
  };

  // Content truncation thresholds
  truncation: {
    notesMaxChars: number;
    productsMaxItems: number;
    talentMaxItems: number;
  };

  // Spacing and visual modifiers
  spacing: {
    cardPadding: 'tight' | 'standard' | 'relaxed';
    rowGap: 'tight' | 'standard' | 'relaxed';
  };

  // Metadata about the resolution
  _meta: {
    documentType: DocumentType;
    presentationStyle: PresentationStyle;
    resolvedAt: number;
    version: string;
  };
}

// ============================================================================
// Document Type Baseline Presets
// ============================================================================

/**
 * Complete baseline configurations for each document type.
 * These define SAFE DEFAULTS that guarantee coherent visual output.
 */
const DOCUMENT_TYPE_BASELINES: Record<DocumentType, Omit<ResolvedExportConfig, '_meta'>> = {
  clientOverview: {
    title: 'Shot Overview',
    subtitle: '',
    orientation: 'portrait',
    layoutMode: 'gallery',
    density: 'detailed',
    galleryColumns: 2,
    includeLaneSummary: true,
    includeTalentSummary: true,
    fields: {
      image: true,
      shotNumber: true,
      shotName: true,
      shotType: true,
      date: true,
      location: true,
      talent: true,
      products: true,
      notes: false, // Notes hidden for client-facing docs
    },
    imageSettings: {
      includeImages: true,
      fallbackToProductImages: true,
      inlineImages: true,
      imageProminence: 'large',
    },
    truncation: {
      notesMaxChars: 100,
      productsMaxItems: 3,
      talentMaxItems: 4,
    },
    spacing: {
      cardPadding: 'relaxed',
      rowGap: 'relaxed',
    },
  },

  internalPlanning: {
    title: 'Production Planner',
    subtitle: '',
    orientation: 'landscape',
    layoutMode: 'table',
    density: 'standard',
    galleryColumns: 3,
    includeLaneSummary: true,
    includeTalentSummary: true,
    fields: {
      image: true,
      shotNumber: true,
      shotName: true,
      shotType: true,
      date: true,
      location: true,
      talent: true,
      products: true,
      notes: true,
    },
    imageSettings: {
      includeImages: true,
      fallbackToProductImages: true,
      inlineImages: true,
      imageProminence: 'medium',
    },
    truncation: {
      notesMaxChars: 200,
      productsMaxItems: 5,
      talentMaxItems: 6,
    },
    spacing: {
      cardPadding: 'standard',
      rowGap: 'standard',
    },
  },

  wardrobeStyling: {
    title: 'Wardrobe & Styling',
    subtitle: '',
    orientation: 'portrait',
    layoutMode: 'gallery',
    density: 'detailed',
    galleryColumns: 2,
    includeLaneSummary: false,
    includeTalentSummary: true,
    fields: {
      image: true,
      shotNumber: true,
      shotName: true,
      shotType: false,
      date: false,
      location: false,
      talent: true,
      products: true, // Products are primary focus
      notes: true,
    },
    imageSettings: {
      includeImages: true,
      fallbackToProductImages: true,
      inlineImages: true,
      imageProminence: 'large',
    },
    truncation: {
      notesMaxChars: 150,
      productsMaxItems: 10, // Show more products
      talentMaxItems: 4,
    },
    spacing: {
      cardPadding: 'relaxed',
      rowGap: 'standard',
    },
  },

  minimal: {
    title: 'Shot List',
    subtitle: '',
    orientation: 'landscape',
    layoutMode: 'table',
    density: 'compact',
    galleryColumns: 1,
    includeLaneSummary: false,
    includeTalentSummary: false,
    fields: {
      image: false,
      shotNumber: true,
      shotName: true,
      shotType: true,
      date: true,
      location: true,
      talent: true,
      products: false,
      notes: false,
    },
    imageSettings: {
      includeImages: false,
      fallbackToProductImages: false,
      inlineImages: false,
      imageProminence: 'hidden',
    },
    truncation: {
      notesMaxChars: 50,
      productsMaxItems: 2,
      talentMaxItems: 3,
    },
    spacing: {
      cardPadding: 'tight',
      rowGap: 'tight',
    },
  },
};

// ============================================================================
// Presentation Style Modifiers
// ============================================================================

interface StyleModifiers {
  density: 'compact' | 'standard' | 'detailed';
  spacing: {
    cardPadding: 'tight' | 'standard' | 'relaxed';
    rowGap: 'tight' | 'standard' | 'relaxed';
  };
  truncation: {
    notesMultiplier: number;
    productsMultiplier: number;
  };
  imageProminenceAdjust: -1 | 0 | 1; // Shift prominence level
}

const STYLE_MODIFIERS: Record<PresentationStyle, StyleModifiers> = {
  clean: {
    density: 'detailed',
    spacing: {
      cardPadding: 'relaxed',
      rowGap: 'relaxed',
    },
    truncation: {
      notesMultiplier: 0.8,
      productsMultiplier: 0.8,
    },
    imageProminenceAdjust: 1, // Increase prominence
  },

  detailed: {
    density: 'standard',
    spacing: {
      cardPadding: 'standard',
      rowGap: 'standard',
    },
    truncation: {
      notesMultiplier: 1.0,
      productsMultiplier: 1.0,
    },
    imageProminenceAdjust: 0, // No change
  },

  compact: {
    density: 'compact',
    spacing: {
      cardPadding: 'tight',
      rowGap: 'tight',
    },
    truncation: {
      notesMultiplier: 0.5,
      productsMultiplier: 0.6,
    },
    imageProminenceAdjust: -1, // Decrease prominence
  },
};

// ============================================================================
// Resolver Engine
// ============================================================================

/**
 * Adjust image prominence based on style modifier
 */
function adjustImageProminence(
  current: 'large' | 'medium' | 'small' | 'hidden',
  adjustment: -1 | 0 | 1
): 'large' | 'medium' | 'small' | 'hidden' {
  const levels: Array<'hidden' | 'small' | 'medium' | 'large'> = ['hidden', 'small', 'medium', 'large'];
  const currentIndex = levels.indexOf(current);
  const newIndex = Math.max(0, Math.min(levels.length - 1, currentIndex + adjustment));
  return levels[newIndex];
}

/**
 * Validate and clamp the config to prevent unsafe combinations
 */
function validateAndClamp(config: Omit<ResolvedExportConfig, '_meta'>): Omit<ResolvedExportConfig, '_meta'> {
  const result = { ...config };

  // RULE: Gallery mode requires at least 1 column, max 6
  if (result.layoutMode === 'gallery') {
    result.galleryColumns = Math.max(1, Math.min(6, result.galleryColumns));
  }

  // RULE: If no images, ensure gallery mode has higher column count for density
  if (!result.imageSettings.includeImages && result.layoutMode === 'gallery') {
    result.galleryColumns = Math.max(3, result.galleryColumns);
  }

  // RULE: If images are hidden, don't allow large/medium prominence
  if (!result.imageSettings.includeImages) {
    result.imageSettings.imageProminence = 'hidden';
  }

  // RULE: Table mode always uses standard columns (not applicable)
  if (result.layoutMode === 'table') {
    result.galleryColumns = 1;
  }

  // RULE: Truncation limits have sensible bounds
  result.truncation.notesMaxChars = Math.max(30, Math.min(500, result.truncation.notesMaxChars));
  result.truncation.productsMaxItems = Math.max(1, Math.min(20, result.truncation.productsMaxItems));
  result.truncation.talentMaxItems = Math.max(1, Math.min(10, result.truncation.talentMaxItems));

  // RULE: At least shot name or shot number must be visible
  if (!result.fields.shotName && !result.fields.shotNumber) {
    result.fields.shotNumber = true;
  }

  // RULE: Compact density cannot have relaxed spacing
  if (result.density === 'compact') {
    if (result.spacing.cardPadding === 'relaxed') {
      result.spacing.cardPadding = 'standard';
    }
    if (result.spacing.rowGap === 'relaxed') {
      result.spacing.rowGap = 'standard';
    }
  }

  return result;
}

/**
 * Main resolver function
 *
 * Takes user intent (document type, content focus, presentation style)
 * and returns a complete, validated export configuration.
 */
export function resolveExportConfig(input: ResolverInput): ResolvedExportConfig {
  const { documentType, contentFocus, presentationStyle, advancedOverrides } = input;

  // Step 1: Load baseline from document type
  const baseline = { ...DOCUMENT_TYPE_BASELINES[documentType] };

  // Deep clone nested objects
  const config: Omit<ResolvedExportConfig, '_meta'> = {
    ...baseline,
    fields: { ...baseline.fields },
    imageSettings: { ...baseline.imageSettings },
    truncation: { ...baseline.truncation },
    spacing: { ...baseline.spacing },
  };

  // Step 2: Apply Content Focus toggles
  // These enable/disable entire semantic groups, never partial fields

  // Summaries toggle
  if (!contentFocus.includeSummaries) {
    config.includeLaneSummary = false;
    config.includeTalentSummary = false;
  }

  // Products toggle
  if (!contentFocus.includeProducts) {
    config.fields.products = false;
    config.truncation.productsMaxItems = 0;
  }

  // Notes toggle
  if (!contentFocus.includeNotes) {
    config.fields.notes = false;
    config.truncation.notesMaxChars = 0;
  }

  // Step 3: Apply Presentation Style modifiers
  const modifiers = STYLE_MODIFIERS[presentationStyle];

  // Only apply density if it makes sense for the document type
  // Minimal always stays compact, Client Overview stays detailed
  if (documentType !== 'minimal' && documentType !== 'clientOverview') {
    config.density = modifiers.density;
  }

  // Apply spacing adjustments
  config.spacing = { ...modifiers.spacing };

  // Apply truncation multipliers
  config.truncation.notesMaxChars = Math.round(
    config.truncation.notesMaxChars * modifiers.truncation.notesMultiplier
  );
  config.truncation.productsMaxItems = Math.round(
    config.truncation.productsMaxItems * modifiers.truncation.productsMultiplier
  );

  // Adjust image prominence
  config.imageSettings.imageProminence = adjustImageProminence(
    config.imageSettings.imageProminence,
    modifiers.imageProminenceAdjust
  );

  // Step 4: Apply advanced overrides (if provided)
  if (advancedOverrides) {
    if (advancedOverrides.customTitle) {
      config.title = advancedOverrides.customTitle;
    }
    if (advancedOverrides.customSubtitle) {
      config.subtitle = advancedOverrides.customSubtitle;
    }
    if (advancedOverrides.orientation) {
      config.orientation = advancedOverrides.orientation;
    }
  }

  // Step 5: Validate and clamp unsafe combinations
  const validatedConfig = validateAndClamp(config);

  // Step 6: Add metadata and return
  return {
    ...validatedConfig,
    _meta: {
      documentType,
      presentationStyle,
      resolvedAt: Date.now(),
      version: '1.0.0',
    },
  };
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default content focus - all enabled
 */
export const DEFAULT_CONTENT_FOCUS: ContentFocus = {
  includeSummaries: true,
  includeProducts: true,
  includeNotes: true,
};

/**
 * Default resolver input
 */
export const DEFAULT_RESOLVER_INPUT: ResolverInput = {
  documentType: 'internalPlanning',
  contentFocus: DEFAULT_CONTENT_FOCUS,
  presentationStyle: 'detailed',
};

// ============================================================================
// Document Type Metadata (for UI)
// ============================================================================

export interface DocumentTypeInfo {
  id: DocumentType;
  name: string;
  description: string;
  icon: string;
}

export const DOCUMENT_TYPES: DocumentTypeInfo[] = [
  {
    id: 'clientOverview',
    name: 'Client Overview',
    description: 'Polished, shareable presentation',
    icon: 'presentation',
  },
  {
    id: 'internalPlanning',
    name: 'Internal Planning',
    description: 'Detailed production reference',
    icon: 'clipboard',
  },
  {
    id: 'wardrobeStyling',
    name: 'Wardrobe & Styling',
    description: 'Product-focused for wardrobe team',
    icon: 'shirt',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Compact data-focused list',
    icon: 'list',
  },
];

export interface PresentationStyleInfo {
  id: PresentationStyle;
  name: string;
  description: string;
}

export const PRESENTATION_STYLES: PresentationStyleInfo[] = [
  {
    id: 'clean',
    name: 'Clean',
    description: 'Spacious, emphasis on visuals',
  },
  {
    id: 'detailed',
    name: 'Detailed',
    description: 'Balanced, all information visible',
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Dense, data-focused',
  },
];

// ============================================================================
// Legacy Bridge Utilities
// ============================================================================

/**
 * Convert resolved config to legacy export options format
 * This bridges the new resolver to the existing export pipeline
 */
export function resolvedConfigToLegacyOptions(config: ResolvedExportConfig): {
  title: string;
  subtitle: string;
  orientation: 'portrait' | 'landscape';
  layout: 'table' | 'gallery';
  density: 'compact' | 'standard' | 'detailed';
  galleryColumns: string;
  fields: Record<string, boolean>;
  includeImages: boolean;
  fallbackToProductImages: boolean;
  inlineImages: boolean;
  includeLaneSummary: boolean;
  includeTalentSummary: boolean;
} {
  return {
    title: config.title,
    subtitle: config.subtitle,
    orientation: config.orientation,
    layout: config.layoutMode,
    density: config.density,
    galleryColumns: String(config.galleryColumns),
    fields: {
      image: config.fields.image,
      shotNumber: config.fields.shotNumber,
      shotName: config.fields.shotName,
      shotType: config.fields.shotType,
      date: config.fields.date,
      location: config.fields.location,
      talent: config.fields.talent,
      products: config.fields.products,
      notes: config.fields.notes,
    },
    includeImages: config.imageSettings.includeImages,
    fallbackToProductImages: config.imageSettings.fallbackToProductImages,
    inlineImages: config.imageSettings.inlineImages,
    includeLaneSummary: config.includeLaneSummary,
    includeTalentSummary: config.includeTalentSummary,
  };
}

export default resolveExportConfig;
