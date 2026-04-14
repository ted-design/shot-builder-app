// src/components/pulls/PullSheetSectionManager.jsx
//
// Drag-and-drop section manager for pull sheet configuration
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
  getSortedSections,
} from '../../lib/pullSheetSections';
import { toast } from '../../lib/toast';

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
  const isVisible = sectionState?.visible !== false;
  const isRequired = section.required;

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
            min="0.4"
            max="5"
            step="0.1"
            value={sectionState?.flex ?? section.flex ?? 1}
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
export default function PullSheetSectionManager({
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

  // Get sorted sections based on current order
  const sections = getSortedSections(SECTION_CONFIG).map((section) => {
    const state = sectionStates[section.id] || {};
    return {
      ...section,
      order: state.order ?? section.order,
    };
  }).sort((a, b) => a.order - b.order);

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
   * Toggle section visibility
   */
  const handleToggle = (sectionId) => {
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
   * Update column flex width
   */
  const handleFlexChange = (sectionId, flex) => {
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
          <li>Drag sections to change their order in the PDF</li>
          <li>Use the eye icon to show/hide sections</li>
          <li>Adjust column widths to prevent text wrapping</li>
          <li>Try layout presets for quick configuration</li>
        </ul>
      </div>
    </div>
  );
}
