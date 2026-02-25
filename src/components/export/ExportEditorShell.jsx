/**
 * ExportEditorShell - Apple-style preset-driven export editor
 *
 * A confidence-first export editor that guarantees visually impeccable output
 * regardless of limited user input. The UI is organized around intent rather
 * than technical settings.
 *
 * Layout (Side-by-Side):
 * ┌──────────────────────┬──────────────────────────────────────────────────┐
 * │ CONTROL RAIL (320px) │  PREVIEW VIEWPORT (flex-1)                       │
 * │ ────────────────────  │                                                  │
 * │ Document Type         │                                                  │
 * │   [Client] [Internal] │                                                  │
 * │   [Wardrobe] [Minimal]│       ┌──────────────────────────────────┐       │
 * │                       │       │                                  │       │
 * │ Content Focus         │       │     Live PDF Preview             │       │
 * │   ☑ Summaries         │       │     (primary scrollable region)  │       │
 * │   ☑ Products          │       │                                  │       │
 * │   ☑ Notes             │       │                                  │       │
 * │                       │       │                                  │       │
 * │ Presentation Style    │       │                                  │       │
 * │   [Clean|Detailed|Cmp]│       │                                  │       │
 * │                       │       └──────────────────────────────────┘       │
 * │ ▸ Advanced Options    │                                                  │
 * │ ────────────────────  │                                                  │
 * │ [Actions Slot]        │                                                  │
 * └──────────────────────┴──────────────────────────────────────────────────┘
 *
 * Scroll behavior:
 * - Control rail: internal scroll if content overflows (rare)
 * - Preview viewport: primary scroll container for PDF pages
 * - No nested scroll conflicts
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Presentation,
  ClipboardList,
  Shirt,
  List,
  Check,
  ChevronDown,
  ChevronRight,
  Settings2,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  resolveExportConfig,
  DOCUMENT_TYPES,
  PRESENTATION_STYLES,
  DEFAULT_CONTENT_FOCUS,
  resolvedConfigToLegacyOptions,
} from '../../lib/exportPresetResolver';

// ============================================================================
// Document Type Card
// ============================================================================

const DOCUMENT_TYPE_ICONS = {
  clientOverview: Presentation,
  internalPlanning: ClipboardList,
  wardrobeStyling: Shirt,
  minimal: List,
};

function DocumentTypeCard({ type, isSelected, onClick }) {
  const Icon = DOCUMENT_TYPE_ICONS[type.id] || List;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 text-left',
        'hover:border-blue-400 hover:shadow-sm',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center transition-colors',
          isSelected
            ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
        )}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'text-xs font-semibold block truncate transition-colors',
            isSelected
              ? 'text-blue-900 dark:text-blue-100'
              : 'text-slate-800 dark:text-slate-200'
          )}
        >
          {type.name}
        </span>
        <span className="text-2xs text-slate-500 dark:text-slate-400 leading-tight line-clamp-1">
          {type.description}
        </span>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="w-4 h-4 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Content Focus Toggles
// ============================================================================

function ContentFocusToggle({ label, checked, onChange, description }) {
  return (
    <label className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 block truncate">
          {label}
        </span>
        {description && (
          <span className="text-2xs text-slate-500 dark:text-slate-400 block truncate">
            {description}
          </span>
        )}
      </div>
    </label>
  );
}

// ============================================================================
// Presentation Style Selector
// ============================================================================

function PresentationStyleSelector({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
      {PRESENTATION_STYLES.map((style) => (
        <button
          key={style.id}
          type="button"
          onClick={() => onChange(style.id)}
          className={cn(
            'flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
            value === style.id
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          )}
        >
          {style.name}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Advanced Options Section
// ============================================================================

function AdvancedOptionsSection({
  isExpanded,
  onToggle,
  title,
  subtitle,
  orientation,
  onTitleChange,
  onSubtitleChange,
  onOrientationChange,
}) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
      >
        <Settings2 className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Advanced Options
        </span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-slate-200 dark:border-slate-700">
          {/* Title */}
          <div>
            <label
              className="text-xs font-medium text-slate-600 dark:text-slate-400"
              htmlFor="export-title"
            >
              Document Title
            </label>
            <input
              id="export-title"
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Auto-generated from preset"
            />
          </div>

          {/* Subtitle */}
          <div>
            <label
              className="text-xs font-medium text-slate-600 dark:text-slate-400"
              htmlFor="export-subtitle"
            >
              Subtitle
            </label>
            <input
              id="export-subtitle"
              type="text"
              value={subtitle}
              onChange={(e) => onSubtitleChange(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Optional"
            />
          </div>

          {/* Orientation */}
          <div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Page Orientation
            </span>
            <div className="mt-1.5 inline-flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700">
              {['portrait', 'landscape'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onOrientationChange(option)}
                  className={cn(
                    'px-3 py-1.5 text-sm capitalize transition-colors',
                    orientation === option
                      ? 'bg-slate-900 dark:bg-slate-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Section Label
// ============================================================================

function SectionLabel({ children, description }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {children}
      </h3>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {description}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ExportEditorShell - Preset-driven export configuration UI
 *
 * @param {Object} props
 * @param {string} props.projectName - Project name for default title
 * @param {Function} props.onConfigChange - Callback when resolved config changes
 * @param {React.ReactNode} props.previewSlot - Slot for preview component
 * @param {React.ReactNode} props.actionsSlot - Slot for action buttons
 */
export default function ExportEditorShell({
  projectName = '',
  initialDocumentType = 'internalPlanning',
  onConfigChange,
  previewSlot,
  actionsSlot,
}) {
  // ============================================================================
  // State
  // ============================================================================

  const [documentType, setDocumentType] = useState(initialDocumentType);
  const [contentFocus, setContentFocus] = useState(DEFAULT_CONTENT_FOCUS);
  const [presentationStyle, setPresentationStyle] = useState('detailed');
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  // Image toggle - simple user-facing control
  // Default based on document type: minimal=false, others=true
  const [includeImages, setIncludeImages] = useState(() => initialDocumentType !== 'minimal');

  // Advanced overrides
  const [customTitle, setCustomTitle] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');
  const [orientation, setOrientation] = useState(null); // null = use preset default

  // ============================================================================
  // Resolved Configuration
  // ============================================================================

  const resolvedConfig = useMemo(() => {
    const config = resolveExportConfig({
      documentType,
      contentFocus,
      presentationStyle,
      advancedOverrides: {
        customTitle: customTitle || (projectName ? `${projectName} Export` : undefined),
        customSubtitle: customSubtitle || undefined,
        orientation: orientation || undefined,
      },
    });

    // Apply user-controlled image toggle override
    // This single toggle controls all image-related settings for simplicity
    return {
      ...config,
      fields: {
        ...config.fields,
        image: includeImages,
      },
      imageSettings: {
        ...config.imageSettings,
        includeImages: includeImages,
        // When images are off, prominence is hidden; when on, keep preset default
        imageProminence: includeImages ? config.imageSettings.imageProminence : 'hidden',
      },
    };
  }, [documentType, contentFocus, presentationStyle, customTitle, customSubtitle, orientation, projectName, includeImages]);

  // Convert to legacy format for existing pipeline
  const legacyOptions = useMemo(
    () => resolvedConfigToLegacyOptions(resolvedConfig),
    [resolvedConfig]
  );

  // Track previous config to prevent unnecessary callbacks
  // STABILITY FIX: Only call onConfigChange when config actually changes
  const prevConfigHashRef = useRef(null);

  // Notify parent of config changes - with stability guard
  useEffect(() => {
    if (!onConfigChange) return;

    // Create a hash of the config to detect actual changes
    // This prevents callback storms when object references change but values don't
    const configHash = JSON.stringify({
      title: resolvedConfig.title,
      subtitle: resolvedConfig.subtitle,
      orientation: resolvedConfig.orientation,
      layoutMode: resolvedConfig.layoutMode,
      density: resolvedConfig.density,
      galleryColumns: resolvedConfig.galleryColumns,
      fields: resolvedConfig.fields,
      includeLaneSummary: resolvedConfig.includeLaneSummary,
      includeTalentSummary: resolvedConfig.includeTalentSummary,
      imageSettings: resolvedConfig.imageSettings,
    });

    // Skip if config hasn't actually changed
    if (configHash === prevConfigHashRef.current) {
      return;
    }

    prevConfigHashRef.current = configHash;
    onConfigChange(resolvedConfig, legacyOptions);
  }, [resolvedConfig, legacyOptions, onConfigChange]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleDocumentTypeChange = useCallback((typeId) => {
    setDocumentType(typeId);
    // Reset orientation override when changing document type
    setOrientation(null);
    // Reset image toggle based on new document type
    // Minimal preset defaults to no images; others include images
    setIncludeImages(typeId !== 'minimal');
  }, []);

  const handleContentFocusChange = useCallback((key, value) => {
    setContentFocus((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="flex h-full overflow-hidden">
      {/* Control Rail (Sidebar) - Sticky, fixed width, internal scroll */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        {/* Scrollable Configuration Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Document Type */}
          <section>
            <SectionLabel description="Choose the purpose of your export">
              Document Type
            </SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {DOCUMENT_TYPES.map((type) => (
                <DocumentTypeCard
                  key={type.id}
                  type={type}
                  isSelected={documentType === type.id}
                  onClick={() => handleDocumentTypeChange(type.id)}
                />
              ))}
            </div>
          </section>

          {/* Content Focus */}
          <section>
            <SectionLabel description="Toggle content sections">
              Content Focus
            </SectionLabel>
            <div className="space-y-1">
              <ContentFocusToggle
                label="Include summaries"
                description="Lane and talent overview tables"
                checked={contentFocus.includeSummaries}
                onChange={(v) => handleContentFocusChange('includeSummaries', v)}
              />
              <ContentFocusToggle
                label="Include products"
                description="Product details on each shot"
                checked={contentFocus.includeProducts}
                onChange={(v) => handleContentFocusChange('includeProducts', v)}
              />
              <ContentFocusToggle
                label="Include notes"
                description="Shot notes and instructions"
                checked={contentFocus.includeNotes}
                onChange={(v) => handleContentFocusChange('includeNotes', v)}
              />
              <ContentFocusToggle
                label="Include images"
                description="Adds thumbnails when available"
                checked={includeImages}
                onChange={setIncludeImages}
              />
            </div>
          </section>

          {/* Presentation Style */}
          <section>
            <SectionLabel description="Adjust density and emphasis">
              Presentation Style
            </SectionLabel>
            <PresentationStyleSelector
              value={presentationStyle}
              onChange={setPresentationStyle}
            />
          </section>

          {/* Advanced Options */}
          <AdvancedOptionsSection
            isExpanded={advancedExpanded}
            onToggle={() => setAdvancedExpanded(!advancedExpanded)}
            title={customTitle || resolvedConfig.title}
            subtitle={customSubtitle}
            orientation={orientation || resolvedConfig.orientation}
            onTitleChange={setCustomTitle}
            onSubtitleChange={setCustomSubtitle}
            onOrientationChange={setOrientation}
          />
        </div>

        {/* Actions Slot - Pinned at bottom of sidebar */}
        {actionsSlot && (
          <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/50">
            {actionsSlot}
          </div>
        )}
      </div>

      {/* Preview Viewport (Primary) - Takes remaining space */}
      <div className="flex-1 min-w-0 flex flex-col bg-slate-100 dark:bg-slate-900">
        <div className="flex-1 overflow-auto p-4">
          {previewSlot || (
            <div className="h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="text-4xl mb-2">Preview</div>
                <p className="text-sm">Live preview will appear here</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Hook for using the shell state externally
// ============================================================================

/**
 * useExportEditorState - Hook for managing export editor state
 *
 * Use this when you need to control the editor state from a parent component.
 */
export function useExportEditorState(options = {}) {
  const { projectName = '', initialDocumentType = 'internalPlanning' } = options;

  const [documentType, setDocumentType] = useState(initialDocumentType);
  const [contentFocus, setContentFocus] = useState(DEFAULT_CONTENT_FOCUS);
  const [presentationStyle, setPresentationStyle] = useState('detailed');
  const [customTitle, setCustomTitle] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');
  const [orientation, setOrientation] = useState(null);

  const resolvedConfig = useMemo(() => {
    return resolveExportConfig({
      documentType,
      contentFocus,
      presentationStyle,
      advancedOverrides: {
        customTitle: customTitle || (projectName ? `${projectName} Export` : undefined),
        customSubtitle: customSubtitle || undefined,
        orientation: orientation || undefined,
      },
    });
  }, [documentType, contentFocus, presentationStyle, customTitle, customSubtitle, orientation, projectName]);

  const legacyOptions = useMemo(
    () => resolvedConfigToLegacyOptions(resolvedConfig),
    [resolvedConfig]
  );

  return {
    // State
    documentType,
    contentFocus,
    presentationStyle,
    customTitle,
    customSubtitle,
    orientation,

    // Setters
    setDocumentType,
    setContentFocus,
    setPresentationStyle,
    setCustomTitle,
    setCustomSubtitle,
    setOrientation,

    // Derived
    resolvedConfig,
    legacyOptions,
  };
}

// Named exports
export { DocumentTypeCard, ContentFocusToggle, PresentationStyleSelector, AdvancedOptionsSection };
