/**
 * ExportSectionPanel - Document-section-based export configuration UI
 *
 * Organizes export settings by document structure:
 * - Document: Page settings (title, subtitle, orientation)
 * - Summaries: Global summary tables (lane, talent)
 * - Shots: Layout, fields, and image settings
 *
 * This component replaces the flat toggle UI with a hierarchical,
 * editorial-feeling interface that matches the document's structure.
 */

import React from 'react';
import { ChevronDown, ChevronRight, FileText, LayoutList, Camera } from 'lucide-react';
import {
  DOCUMENT_SECTIONS,
  SUMMARY_CONFIGS,
  SHOT_FIELD_CONFIGS,
  getOrderedDocumentSections,
} from '../../lib/documentModel';

// ============================================================================
// Section Header Component
// ============================================================================

function SectionHeader({ section, icon: Icon, isExpanded, onToggle, children }) {
  return (
    <div className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {section.label}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {section.description}
          </p>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 space-y-4 bg-slate-50/50 dark:bg-slate-800/30">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Document Section
// ============================================================================

function DocumentSection({
  title,
  subtitle,
  orientation,
  onTitleChange,
  onSubtitleChange,
  onOrientationChange,
}) {
  return (
    <>
      <div>
        <label
          className="text-xs font-medium text-slate-700 dark:text-slate-300"
          htmlFor="export-title"
        >
          Page Title
        </label>
        <input
          id="export-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
          placeholder="Planner Export"
        />
      </div>

      <div>
        <label
          className="text-xs font-medium text-slate-700 dark:text-slate-300"
          htmlFor="export-subtitle"
        >
          Subtitle
        </label>
        <input
          id="export-subtitle"
          type="text"
          value={subtitle}
          onChange={(e) => onSubtitleChange(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
          placeholder="Generated automatically"
        />
      </div>

      <div>
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          Page Orientation
        </span>
        <div className="mt-1.5 inline-flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          {['portrait', 'landscape'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onOrientationChange(option)}
              className={`px-3 py-1.5 text-sm capitalize transition ${
                orientation === option
                  ? 'bg-slate-900 dark:bg-slate-700 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Summaries Section
// ============================================================================

function SummariesSection({
  includeLaneSummary,
  includeTalentSummary,
  onLaneSummaryChange,
  onTalentSummaryChange,
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Summary tables appear once at the top of your document, providing an
        overview before the detailed shot list.
      </p>

      <div className="space-y-2">
        <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={includeLaneSummary}
            onChange={(e) => onLaneSummaryChange(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary"
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {SUMMARY_CONFIGS.laneSummary.label}
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {SUMMARY_CONFIGS.laneSummary.description}
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={includeTalentSummary}
            onChange={(e) => onTalentSummaryChange(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary"
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {SUMMARY_CONFIGS.talentSummary.label}
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {SUMMARY_CONFIGS.talentSummary.description}
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}

// ============================================================================
// Shots Section
// ============================================================================

function ShotsSection({
  layoutMode,
  density,
  densityPresets,
  includeImages,
  fallbackToProductImages,
  inlineImages,
  onLayoutModeChange,
  onDensityChange,
  onIncludeImagesChange,
  onFallbackChange,
  onInlineImagesChange,
  children,
}) {
  return (
    <div className="space-y-5">
      {/* Layout Mode */}
      <div>
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          Layout Mode
        </span>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-2">
          Choose how shots are displayed in the document.
        </p>
        <div className="inline-flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          {[
            { value: 'table', label: 'Table' },
            { value: 'gallery', label: 'Gallery' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onLayoutModeChange(option.value)}
              className={`px-3 py-1.5 text-sm transition ${
                layoutMode === option.value
                  ? 'bg-slate-900 dark:bg-slate-700 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Density (Gallery mode only) */}
      {layoutMode === 'gallery' && densityPresets && (
        <div>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Density
          </span>
          <div className="mt-2 space-y-2">
            {Object.values(densityPresets).map((preset) => (
              <label
                key={preset.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <input
                  type="radio"
                  name="density"
                  value={preset.id}
                  checked={density === preset.id}
                  onChange={() => onDensityChange(preset.id)}
                  className="mt-0.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {preset.label}
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {preset.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Image Settings */}
      <div>
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          Images
        </span>
        <div className="mt-2 space-y-2">
          <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={includeImages}
              onChange={(e) => onIncludeImagesChange(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary"
            />
            <div className="flex-1">
              <span className="text-sm text-slate-900 dark:text-slate-100">
                Include shot images
              </span>
            </div>
          </label>

          {includeImages && (
            <>
              <label className="flex items-start gap-3 p-2 pl-8 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={fallbackToProductImages}
                  onChange={(e) => onFallbackChange(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Use product images when shot image is missing
                </span>
              </label>

              <label className="flex items-start gap-3 p-2 pl-8 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={inlineImages}
                  onChange={(e) => onInlineImagesChange(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Embed images in PDF (better compatibility)
                </span>
              </label>
            </>
          )}
        </div>
      </div>

      {/* Field Configuration (passed as children) */}
      {children}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ExportSectionPanel({
  // Document settings
  title,
  subtitle,
  orientation,
  onTitleChange,
  onSubtitleChange,
  onOrientationChange,

  // Summaries
  includeLaneSummary,
  includeTalentSummary,
  onLaneSummaryChange,
  onTalentSummaryChange,

  // Shots layout
  layoutMode,
  density,
  densityPresets,
  onLayoutModeChange,
  onDensityChange,

  // Image settings
  includeImages,
  fallbackToProductImages,
  inlineImages,
  onIncludeImagesChange,
  onFallbackChange,
  onInlineImagesChange,

  // Expanded state
  expandedSections = { header: true, summaries: true, shots: true },
  onSectionToggle,

  // Children for field configuration
  children,
}) {
  const sections = getOrderedDocumentSections();

  const sectionIcons = {
    header: FileText,
    summaries: LayoutList,
    shots: Camera,
  };

  const handleSectionToggle = (sectionId) => {
    if (onSectionToggle) {
      onSectionToggle(sectionId, !expandedSections[sectionId]);
    }
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      {sections.map((section) => (
        <SectionHeader
          key={section.id}
          section={section}
          icon={sectionIcons[section.id]}
          isExpanded={expandedSections[section.id]}
          onToggle={() => handleSectionToggle(section.id)}
        >
          {section.id === 'header' && (
            <DocumentSection
              title={title}
              subtitle={subtitle}
              orientation={orientation}
              onTitleChange={onTitleChange}
              onSubtitleChange={onSubtitleChange}
              onOrientationChange={onOrientationChange}
            />
          )}

          {section.id === 'summaries' && (
            <SummariesSection
              includeLaneSummary={includeLaneSummary}
              includeTalentSummary={includeTalentSummary}
              onLaneSummaryChange={onLaneSummaryChange}
              onTalentSummaryChange={onTalentSummaryChange}
            />
          )}

          {section.id === 'shots' && (
            <ShotsSection
              layoutMode={layoutMode}
              density={density}
              densityPresets={densityPresets}
              includeImages={includeImages}
              fallbackToProductImages={fallbackToProductImages}
              inlineImages={inlineImages}
              onLayoutModeChange={onLayoutModeChange}
              onDensityChange={onDensityChange}
              onIncludeImagesChange={onIncludeImagesChange}
              onFallbackChange={onFallbackChange}
              onInlineImagesChange={onInlineImagesChange}
            >
              {children}
            </ShotsSection>
          )}
        </SectionHeader>
      ))}
    </div>
  );
}

// Named exports for granular usage
export { DocumentSection, SummariesSection, ShotsSection, SectionHeader };
