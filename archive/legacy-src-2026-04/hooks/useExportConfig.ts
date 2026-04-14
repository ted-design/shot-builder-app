/**
 * useExportConfig - Centralized state management for planner export modal
 *
 * Consolidates 20+ useState calls into a single reducer with:
 * - Document settings (title, subtitle, orientation)
 * - Layout settings (mode, density, columns)
 * - Column visibility and custom labels
 * - Filter settings (lanes, talent, dates)
 * - Image settings
 * - Preset application
 */

import { useReducer, useMemo } from 'react';
import {
  getDefaultSectionConfig,
  getVisibleFieldKeys,
  SECTION_TYPES,
} from '../lib/plannerSheetSections';

// Type for section states returned by getDefaultSectionConfig()
export type SectionStates = Record<string, {
  visible: boolean;
  order: number;
  flex?: number;
}>;

// ============================================================================
// Types
// ============================================================================

export type Orientation = 'portrait' | 'landscape';
export type LayoutMode = 'table' | 'gallery';
export type Density = 'compact' | 'standard' | 'detailed';
export type LaneFilterMode = 'all' | 'selected';
export type DateFilterMode = 'any' | 'specific';

export interface ExportConfig {
  // Document settings
  title: string;
  subtitle: string;
  orientation: Orientation;

  // Layout settings
  layoutMode: LayoutMode;
  density: Density;
  galleryColumns: string;

  // Column settings
  sectionStates: SectionStates;
  customLabels: Record<string, string>;

  // Image settings
  includeImages: boolean;
  fallbackToProductImages: boolean;
  inlineImages: boolean;

  // Summary settings
  includeLaneSummary: boolean;
  includeTalentSummary: boolean;

  // Filter settings
  laneFilterMode: LaneFilterMode;
  selectedLaneIds: string[];
  selectedTalentNames: string[];
  dateFilterMode: DateFilterMode;
  selectedDate: string;

  // Track preset state
  activePreset: PresetName | null;
  isModified: boolean;
}

export type PresetName = 'printReady' | 'digitalShare' | 'minimalTable';

// ============================================================================
// Presets
// ============================================================================

export const EXPORT_PRESETS: Record<PresetName, {
  name: string;
  icon: string;
  description: string;
  config: Partial<ExportConfig>;
}> = {
  printReady: {
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
  digitalShare: {
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
  minimalTable: {
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
};

// ============================================================================
// Actions
// ============================================================================

export type ExportAction =
  // Document
  | { type: 'SET_TITLE'; title: string }
  | { type: 'SET_SUBTITLE'; subtitle: string }
  | { type: 'SET_ORIENTATION'; orientation: Orientation }
  // Layout
  | { type: 'SET_LAYOUT_MODE'; mode: LayoutMode }
  | { type: 'SET_DENSITY'; density: Density }
  | { type: 'SET_GALLERY_COLUMNS'; columns: string }
  // Columns
  | { type: 'SET_SECTION_STATES'; states: SectionStates }
  | { type: 'TOGGLE_SECTION'; sectionId: string }
  | { type: 'SET_CUSTOM_LABEL'; sectionId: string; label: string }
  | { type: 'RESET_CUSTOM_LABEL'; sectionId: string }
  | { type: 'REORDER_SECTIONS'; fromIndex: number; toIndex: number }
  // Images
  | { type: 'TOGGLE_IMAGES' }
  | { type: 'SET_INCLUDE_IMAGES'; include: boolean }
  | { type: 'TOGGLE_FALLBACK_TO_PRODUCT_IMAGES' }
  | { type: 'TOGGLE_INLINE_IMAGES' }
  // Summary
  | { type: 'TOGGLE_LANE_SUMMARY' }
  | { type: 'TOGGLE_TALENT_SUMMARY' }
  // Filters
  | { type: 'SET_LANE_FILTER_MODE'; mode: LaneFilterMode }
  | { type: 'SET_SELECTED_LANE_IDS'; ids: string[] }
  | { type: 'SET_SELECTED_TALENT_NAMES'; names: string[] }
  | { type: 'SET_DATE_FILTER_MODE'; mode: DateFilterMode }
  | { type: 'SET_SELECTED_DATE'; date: string }
  | { type: 'CLEAR_FILTERS' }
  // Presets
  | { type: 'APPLY_PRESET'; preset: PresetName }
  | { type: 'RESET_TO_DEFAULTS' };

// ============================================================================
// Reducer
// ============================================================================

function getDefaultConfig(projectName?: string): ExportConfig {
  const defaultSectionStates = getDefaultSectionConfig();

  return {
    // Document
    title: projectName || 'Planner export',
    subtitle: '',
    orientation: 'portrait',

    // Layout
    layoutMode: 'table',
    density: 'standard',
    galleryColumns: '3',

    // Columns
    sectionStates: defaultSectionStates,
    customLabels: {},

    // Images - default ON as per user requirement
    includeImages: true,
    fallbackToProductImages: true,
    inlineImages: true,

    // Summary
    includeLaneSummary: true,
    includeTalentSummary: true,

    // Filters
    laneFilterMode: 'all',
    selectedLaneIds: [],
    selectedTalentNames: [],
    dateFilterMode: 'any',
    selectedDate: '',

    // Preset tracking
    activePreset: null,
    isModified: false,
  };
}

function exportConfigReducer(state: ExportConfig, action: ExportAction): ExportConfig {
  // Helper to mark config as modified from preset
  const markModified = (newState: Partial<ExportConfig>): ExportConfig => ({
    ...state,
    ...newState,
    isModified: state.activePreset !== null,
  });

  switch (action.type) {
    // Document
    case 'SET_TITLE':
      return markModified({ title: action.title });
    case 'SET_SUBTITLE':
      return markModified({ subtitle: action.subtitle });
    case 'SET_ORIENTATION':
      return markModified({ orientation: action.orientation });

    // Layout
    case 'SET_LAYOUT_MODE':
      return markModified({ layoutMode: action.mode });
    case 'SET_DENSITY':
      return markModified({ density: action.density });
    case 'SET_GALLERY_COLUMNS':
      return markModified({ galleryColumns: action.columns });

    // Columns
    case 'SET_SECTION_STATES':
      return markModified({ sectionStates: action.states });
    case 'TOGGLE_SECTION': {
      const currentState = state.sectionStates[action.sectionId];
      if (!currentState) return state;
      return markModified({
        sectionStates: {
          ...state.sectionStates,
          [action.sectionId]: {
            ...currentState,
            visible: !currentState.visible,
          },
        },
      });
    }
    case 'SET_CUSTOM_LABEL':
      return markModified({
        customLabels: {
          ...state.customLabels,
          [action.sectionId]: action.label,
        },
      });
    case 'RESET_CUSTOM_LABEL': {
      const { [action.sectionId]: _, ...rest } = state.customLabels;
      return markModified({ customLabels: rest });
    }
    case 'REORDER_SECTIONS': {
      // Implement section reordering logic here if needed
      return state;
    }

    // Images
    case 'TOGGLE_IMAGES':
      return markModified({ includeImages: !state.includeImages });
    case 'SET_INCLUDE_IMAGES':
      return markModified({ includeImages: action.include });
    case 'TOGGLE_FALLBACK_TO_PRODUCT_IMAGES':
      return markModified({ fallbackToProductImages: !state.fallbackToProductImages });
    case 'TOGGLE_INLINE_IMAGES':
      return markModified({ inlineImages: !state.inlineImages });

    // Summary
    case 'TOGGLE_LANE_SUMMARY':
      return markModified({ includeLaneSummary: !state.includeLaneSummary });
    case 'TOGGLE_TALENT_SUMMARY':
      return markModified({ includeTalentSummary: !state.includeTalentSummary });

    // Filters
    case 'SET_LANE_FILTER_MODE':
      return markModified({ laneFilterMode: action.mode });
    case 'SET_SELECTED_LANE_IDS':
      return markModified({ selectedLaneIds: action.ids });
    case 'SET_SELECTED_TALENT_NAMES':
      return markModified({ selectedTalentNames: action.names });
    case 'SET_DATE_FILTER_MODE':
      return markModified({ dateFilterMode: action.mode });
    case 'SET_SELECTED_DATE':
      return markModified({ selectedDate: action.date });
    case 'CLEAR_FILTERS':
      return markModified({
        laneFilterMode: 'all',
        selectedLaneIds: [],
        selectedTalentNames: [],
        dateFilterMode: 'any',
        selectedDate: '',
      });

    // Presets
    case 'APPLY_PRESET': {
      const preset = EXPORT_PRESETS[action.preset];
      if (!preset) return state;

      // Apply preset config while preserving filters and title
      return {
        ...state,
        ...preset.config,
        // Preserve user's filters and document title
        title: state.title,
        subtitle: state.subtitle,
        laneFilterMode: state.laneFilterMode,
        selectedLaneIds: state.selectedLaneIds,
        selectedTalentNames: state.selectedTalentNames,
        dateFilterMode: state.dateFilterMode,
        selectedDate: state.selectedDate,
        // Track preset state
        activePreset: action.preset,
        isModified: false,
      };
    }
    case 'RESET_TO_DEFAULTS':
      return {
        ...getDefaultConfig(state.title),
        // Preserve filters when resetting
        laneFilterMode: state.laneFilterMode,
        selectedLaneIds: state.selectedLaneIds,
        selectedTalentNames: state.selectedTalentNames,
        dateFilterMode: state.dateFilterMode,
        selectedDate: state.selectedDate,
      };

    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

export interface Lane {
  id: string;
  name?: string;
  shots?: Array<{
    id: string;
    name?: string;
    date?: string;
    talent?: string[];
    [key: string]: unknown;
  }>;
}

export interface UseExportConfigOptions {
  projectName?: string;
  initialPreset?: PresetName;
}

export function useExportConfig(
  lanes: Lane[],
  options: UseExportConfigOptions = {}
) {
  const { projectName, initialPreset } = options;

  // Initialize with default config
  const [config, dispatch] = useReducer(
    exportConfigReducer,
    undefined,
    () => {
      const defaultConfig = getDefaultConfig(projectName);
      if (initialPreset && EXPORT_PRESETS[initialPreset]) {
        return {
          ...defaultConfig,
          ...EXPORT_PRESETS[initialPreset].config,
          activePreset: initialPreset,
          isModified: false,
        };
      }
      return defaultConfig;
    }
  );

  // Derive fields from section states (for backward compatibility)
  const fields = useMemo(
    () => getVisibleFieldKeys(config.sectionStates),
    [config.sectionStates]
  );

  // Derive include images from section states
  const includeImages = useMemo(() => {
    const imageSection = config.sectionStates[SECTION_TYPES.IMAGE];
    return imageSection?.visible !== false && config.includeImages;
  }, [config.sectionStates, config.includeImages]);

  // Filter lanes based on config
  const filteredLanes = useMemo(() => {
    let result = [...lanes];

    // Filter by lane selection
    if (config.laneFilterMode === 'selected' && config.selectedLaneIds.length > 0) {
      result = result.filter(lane => config.selectedLaneIds.includes(lane.id));
    }

    // Filter shots by talent
    if (config.selectedTalentNames.length > 0) {
      result = result.map(lane => ({
        ...lane,
        shots: (lane.shots || []).filter(shot => {
          const shotTalent = shot.talent || [];
          return config.selectedTalentNames.some(name => shotTalent.includes(name));
        }),
      })).filter(lane => (lane.shots || []).length > 0);
    }

    // Filter shots by date
    if (config.dateFilterMode === 'specific' && config.selectedDate) {
      result = result.map(lane => ({
        ...lane,
        shots: (lane.shots || []).filter(shot => shot.date === config.selectedDate),
      })).filter(lane => (lane.shots || []).length > 0);
    }

    return result;
  }, [lanes, config.laneFilterMode, config.selectedLaneIds, config.selectedTalentNames, config.dateFilterMode, config.selectedDate]);

  // Count total shots after filtering
  const totalShots = useMemo(
    () => filteredLanes.reduce((sum, lane) => sum + (lane.shots?.length || 0), 0),
    [filteredLanes]
  );

  // Extract unique talent names from all lanes
  const availableTalent = useMemo(() => {
    const talentSet = new Set<string>();
    lanes.forEach(lane => {
      (lane.shots || []).forEach(shot => {
        (shot.talent || []).forEach(name => talentSet.add(name));
      });
    });
    return Array.from(talentSet).sort();
  }, [lanes]);

  // Extract unique dates from all lanes
  const availableDates = useMemo(() => {
    const dateSet = new Set<string>();
    lanes.forEach(lane => {
      (lane.shots || []).forEach(shot => {
        if (shot.date) dateSet.add(shot.date);
      });
    });
    return Array.from(dateSet).sort();
  }, [lanes]);

  // Convenience action dispatchers
  const actions = useMemo(() => ({
    setTitle: (title: string) => dispatch({ type: 'SET_TITLE', title }),
    setSubtitle: (subtitle: string) => dispatch({ type: 'SET_SUBTITLE', subtitle }),
    setOrientation: (orientation: Orientation) => dispatch({ type: 'SET_ORIENTATION', orientation }),
    setLayoutMode: (mode: LayoutMode) => dispatch({ type: 'SET_LAYOUT_MODE', mode }),
    setDensity: (density: Density) => dispatch({ type: 'SET_DENSITY', density }),
    setGalleryColumns: (columns: string) => dispatch({ type: 'SET_GALLERY_COLUMNS', columns }),
    setSectionStates: (states: SectionStates) => dispatch({ type: 'SET_SECTION_STATES', states }),
    toggleSection: (sectionId: string) => dispatch({ type: 'TOGGLE_SECTION', sectionId }),
    setCustomLabel: (sectionId: string, label: string) => dispatch({ type: 'SET_CUSTOM_LABEL', sectionId, label }),
    resetCustomLabel: (sectionId: string) => dispatch({ type: 'RESET_CUSTOM_LABEL', sectionId }),
    toggleImages: () => dispatch({ type: 'TOGGLE_IMAGES' }),
    setIncludeImages: (include: boolean) => dispatch({ type: 'SET_INCLUDE_IMAGES', include }),
    toggleFallbackToProductImages: () => dispatch({ type: 'TOGGLE_FALLBACK_TO_PRODUCT_IMAGES' }),
    toggleInlineImages: () => dispatch({ type: 'TOGGLE_INLINE_IMAGES' }),
    toggleLaneSummary: () => dispatch({ type: 'TOGGLE_LANE_SUMMARY' }),
    toggleTalentSummary: () => dispatch({ type: 'TOGGLE_TALENT_SUMMARY' }),
    setLaneFilterMode: (mode: LaneFilterMode) => dispatch({ type: 'SET_LANE_FILTER_MODE', mode }),
    setSelectedLaneIds: (ids: string[]) => dispatch({ type: 'SET_SELECTED_LANE_IDS', ids }),
    setSelectedTalentNames: (names: string[]) => dispatch({ type: 'SET_SELECTED_TALENT_NAMES', names }),
    setDateFilterMode: (mode: DateFilterMode) => dispatch({ type: 'SET_DATE_FILTER_MODE', mode }),
    setSelectedDate: (date: string) => dispatch({ type: 'SET_SELECTED_DATE', date }),
    clearFilters: () => dispatch({ type: 'CLEAR_FILTERS' }),
    applyPreset: (preset: PresetName) => dispatch({ type: 'APPLY_PRESET', preset }),
    resetToDefaults: () => dispatch({ type: 'RESET_TO_DEFAULTS' }),
  }), []);

  // Build export options object (for backward compatibility with existing code)
  const exportOptions = useMemo(() => ({
    title: config.title,
    subtitle: config.subtitle,
    orientation: config.orientation,
    layout: config.layoutMode,
    density: config.density,
    galleryColumns: config.galleryColumns,
    fields,
    customLabels: config.customLabels,
    includeImages,
    fallbackToProductImages: config.fallbackToProductImages,
    inlineImages: config.inlineImages,
    includeLaneSummary: config.includeLaneSummary,
    includeTalentSummary: config.includeTalentSummary,
  }), [config, fields, includeImages]);

  return {
    // State
    config,
    dispatch,

    // Derived values
    fields,
    includeImages,
    filteredLanes,
    totalShots,
    availableTalent,
    availableDates,
    exportOptions,

    // Convenience actions
    ...actions,
  };
}

export default useExportConfig;
