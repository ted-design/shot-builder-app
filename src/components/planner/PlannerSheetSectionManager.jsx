// src/components/planner/PlannerSheetSectionManager.jsx
//
// Drag-and-drop section manager for planner sheet configuration
// Allows users to reorder and toggle sections with WYSIWYG preview

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import {
  SECTION_CONFIG,
  SECTION_TYPES,
  getSortedSections,
  LAYOUT_PRESETS,
} from '../../lib/plannerSheetSections';
import { toast } from '../../lib/toast';

// Define combined section groups that appear as single entries in the PDF
const COMBINED_SECTIONS = {
  SHOT_COMBINED: {
    id: 'SHOT_COMBINED',
    label: 'Shot',
    description: 'Shot number and title (combined in PDF)',
    sections: [SECTION_TYPES.SHOT_NUMBER, SECTION_TYPES.SHOT_NAME],
    icon: SECTION_CONFIG[SECTION_TYPES.SHOT_NUMBER]?.icon,
    category: 'columns',
  },
  DATE_LOC_COMBINED: {
    id: 'DATE_LOC_COMBINED',
    label: 'Date/Location',
    description: 'Date and location (combined in PDF)',
    sections: [SECTION_TYPES.DATE, SECTION_TYPES.LOCATION],
    icon: SECTION_CONFIG[SECTION_TYPES.DATE]?.icon,
    category: 'columns',
  },
};

/**
 * Individual sortable section item
 */
function SortableSection({ section, sectionState, onToggle, onFlexChange }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const IconComponent = section.icon;
  // For combined sections, use the combined visibility; otherwise regular
  const isVisible = section.isCombined
    ? section.combinedVisible
    : sectionState?.visible !== false;
  const isRequired = section.required;
  // For combined sections, use combined flex; otherwise regular
  const currentFlex = section.isCombined
    ? section.combinedFlex
    : (sectionState?.flex ?? section.flex ?? 1);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 p-3 rounded-lg border transition-all
        ${isVisible
          ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60'
        }
        ${isDragging ? 'shadow-lg z-50' : 'shadow-sm'}
      `}
    >
      {/* Drag Handle */}
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${section.label}`}
      >
        <GripVertical className="w-5 h-5" />
      </button>

      {/* Section Icon */}
      <div className={`
        flex items-center justify-center w-8 h-8 rounded
        ${isVisible
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600'
        }
      `}>
        <IconComponent className="w-4 h-4" />
      </div>

      {/* Section Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {section.label}
          </h4>
          {isRequired && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              Required
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
          {section.description}
        </p>
      </div>

      {/* Flex Width Control (for columns) */}
      {section.category === 'columns' && isVisible && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 dark:text-slate-400">Width:</label>
          <input
            type="number"
            min="0.5"
            max={section.isCombined ? 6 : 3}
            step="0.1"
            value={currentFlex}
            onChange={(e) => onFlexChange(section.id, parseFloat(e.target.value) || 1)}
            className="w-16 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Visibility Toggle */}
      <button
        type="button"
        onClick={() => onToggle(section.id)}
        disabled={isRequired}
        className={`
          flex items-center justify-center w-10 h-10 rounded transition-colors
          ${isRequired
            ? 'cursor-not-allowed opacity-40'
            : 'hover:bg-slate-100 dark:hover:bg-slate-700'
          }
        `}
        aria-label={isVisible ? `Hide ${section.label}` : `Show ${section.label}`}
        title={isRequired ? 'Required section' : (isVisible ? 'Hide section' : 'Show section')}
      >
        {isVisible ? (
          <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        ) : (
          <EyeOff className="w-5 h-5 text-slate-400" />
        )}
      </button>
    </div>
  );
}

/**
 * Main section manager component
 */
export default function PlannerSheetSectionManager({
  sectionStates,
  onSectionStatesChange,
  onPresetApply,
}) {

  // Setup sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // IDs that are part of combined sections
  const combinedSectionIds = new Set(
    Object.values(COMBINED_SECTIONS).flatMap(c => c.sections)
  );

  // Get sorted sections based on current order, consolidating combined sections
  const buildConsolidatedSections = () => {
    const allSections = getSortedSections(SECTION_CONFIG);
    const result = [];
    const processed = new Set();

    allSections.forEach((section) => {
      if (processed.has(section.id)) return;

      // Check if this section is part of a combined group
      const combinedGroup = Object.values(COMBINED_SECTIONS).find(
        c => c.sections.includes(section.id)
      );

      if (combinedGroup) {
        // Only add combined group once
        if (!processed.has(combinedGroup.id)) {
          processed.add(combinedGroup.id);
          combinedGroup.sections.forEach(id => processed.add(id));

          // Check if any section in the group is visible
          const anyVisible = combinedGroup.sections.some(
            id => sectionStates[id]?.visible !== false
          );

          // Get the combined flex (sum of individual flex values)
          const combinedFlex = combinedGroup.sections.reduce((sum, id) => {
            const sectionConfig = SECTION_CONFIG[id];
            return sum + (sectionStates[id]?.flex ?? sectionConfig?.flex ?? 1);
          }, 0);

          // Use the first section's order for the combined group
          const firstSectionId = combinedGroup.sections[0];
          const firstSectionOrder = sectionStates[firstSectionId]?.order ??
            SECTION_CONFIG[firstSectionId]?.order ?? 0;

          result.push({
            ...combinedGroup,
            order: firstSectionOrder,
            isCombined: true,
            combinedVisible: anyVisible,
            combinedFlex,
          });
        }
      } else {
        // Regular section
        processed.add(section.id);
        const state = sectionStates[section.id] || {};
        result.push({
          ...section,
          order: state.order ?? section.order,
          isCombined: false,
        });
      }
    });

    return result.sort((a, b) => a.order - b.order);
  };

  const sections = buildConsolidatedSections();
  const sectionIds = sections.map(s => s.id);

  /**
   * Handle drag end - reorder sections
   */
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sectionIds.indexOf(active.id);
      const newIndex = sectionIds.indexOf(over.id);

      const reorderedIds = arrayMove(sectionIds, oldIndex, newIndex);

      // Update order in section states
      const newStates = { ...sectionStates };
      reorderedIds.forEach((id, index) => {
        newStates[id] = {
          ...newStates[id],
          order: index,
        };
      });

      onSectionStatesChange(newStates);
    }
  };

  /**
   * Toggle section visibility (handles combined sections)
   */
  const handleToggle = (sectionId) => {
    // Check if this is a combined section
    const combinedGroup = COMBINED_SECTIONS[sectionId];

    if (combinedGroup) {
      // Toggle all sections in the combined group
      const anyVisible = combinedGroup.sections.some(
        id => sectionStates[id]?.visible !== false
      );
      const newVisible = !anyVisible;

      const newStates = { ...sectionStates };
      combinedGroup.sections.forEach(id => {
        newStates[id] = {
          ...newStates[id],
          visible: newVisible,
        };
      });

      onSectionStatesChange(newStates);
      return;
    }

    // Regular section
    const section = SECTION_CONFIG[sectionId];
    if (section?.required) return; // Can't toggle required sections

    const newStates = {
      ...sectionStates,
      [sectionId]: {
        ...sectionStates[sectionId],
        visible: !(sectionStates[sectionId]?.visible ?? true),
      },
    };

    onSectionStatesChange(newStates);
  };

  /**
   * Update column flex width (handles combined sections)
   */
  const handleFlexChange = (sectionId, flex) => {
    // Check if this is a combined section
    const combinedGroup = COMBINED_SECTIONS[sectionId];

    if (combinedGroup) {
      // Distribute the new flex proportionally to underlying sections
      const currentTotal = combinedGroup.sections.reduce((sum, id) => {
        const sectionConfig = SECTION_CONFIG[id];
        return sum + (sectionStates[id]?.flex ?? sectionConfig?.flex ?? 1);
      }, 0);

      const newStates = { ...sectionStates };
      combinedGroup.sections.forEach(id => {
        const sectionConfig = SECTION_CONFIG[id];
        const currentFlex = sectionStates[id]?.flex ?? sectionConfig?.flex ?? 1;
        const proportion = currentFlex / currentTotal;
        newStates[id] = {
          ...newStates[id],
          flex: Math.round(flex * proportion * 10) / 10, // Round to 1 decimal
        };
      });

      onSectionStatesChange(newStates);
      return;
    }

    // Regular section
    const newStates = {
      ...sectionStates,
      [sectionId]: {
        ...sectionStates[sectionId],
        flex,
      },
    };

    onSectionStatesChange(newStates);
  };

  /**
   * Show/hide all sections
   */
  const handleToggleAll = (visible) => {
    const newStates = { ...sectionStates };
    Object.keys(SECTION_CONFIG).forEach((sectionId) => {
      const section = SECTION_CONFIG[sectionId];
      if (!section.required) {
        newStates[sectionId] = {
          ...newStates[sectionId],
          visible,
        };
      }
    });
    onSectionStatesChange(newStates);
  };

  /**
   * Apply a layout preset
   */
  const handlePresetChange = (e) => {
    const presetId = e.target.value;
    if (!presetId) return;

    const preset = LAYOUT_PRESETS[presetId];
    if (!preset) return;

    // Apply preset
    const newStates = { ...sectionStates };
    Object.entries(preset.sections).forEach(([sectionId, settings]) => {
      newStates[sectionId] = {
        ...newStates[sectionId],
        ...settings,
      };
    });

    onSectionStatesChange(newStates);

    // Notify parent if preset has additional settings
    if (onPresetApply) {
      onPresetApply(preset);
    }

    toast.success({ title: `Applied "${preset.name}" preset` });
  };

  // Count visible sections
  const visibleCount = sections.filter(s => sectionStates[s.id]?.visible !== false).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Section Configuration
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {visibleCount} of {sections.length} sections visible
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleToggleAll(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Show All
          </button>
          <button
            type="button"
            onClick={() => handleToggleAll(false)}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Hide All
          </button>
        </div>
      </div>

      {/* Layout Presets */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Layout Presets
        </label>
        <select
          onChange={handlePresetChange}
          defaultValue=""
          className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 text-sm"
        >
          <option value="">Select a preset...</option>
          {Object.values(LAYOUT_PRESETS).map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name} - {preset.description}
            </option>
          ))}
        </select>
      </div>

      {/* Sortable Section List */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Sections (drag to reorder)
        </label>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sectionIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sections.map((section) => (
                <SortableSection
                  key={section.id}
                  section={section}
                  sectionState={sectionStates[section.id]}
                  onToggle={handleToggle}
                  onFlexChange={handleFlexChange}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Help Text */}
      <div className="text-xs text-slate-500 dark:text-slate-400 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
        <p className="font-medium mb-1">Tips:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Drag sections to change their order in the export</li>
          <li>Use the eye icon to show/hide sections</li>
          <li>Adjust column widths to fit your content</li>
          <li>Try layout presets for quick configuration</li>
        </ul>
      </div>
    </div>
  );
}
