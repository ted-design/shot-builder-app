import React, { useMemo } from "react";
import {
  Bell,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  LayoutTemplate,
  MapPin,
  ScrollText,
  Star,
  Users,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "../../lib/utils";

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  header: LayoutTemplate,
  "day-details": Clock,
  reminders: Bell,
  schedule: Calendar,
  talent: Star,
  crew: Users,
  notes: FileText,
  locations: MapPin,
  "page-break": ScrollText,
};

export interface LayoutSidebarSection {
  id: string;
  name: string;
  enabled: boolean;
  pageBreakAfter?: boolean;
}

interface LayoutSidebarProps {
  sections: LayoutSidebarSection[];
  onReorder: (sections: LayoutSidebarSection[]) => void;
  onToggle: (id: string) => void;
  onPageBreakToggle: (id: string) => void;
}

function SortableRow({
  section,
  active,
  onToggle,
}: {
  section: LayoutSidebarSection;
  active: boolean;
  onToggle: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const Icon = SECTION_ICONS[section.id] || FileText;
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded-md border",
        active ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200",
        section.enabled ? "" : "opacity-60",
        isDragging ? "shadow-md" : ""
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
        aria-label={`Drag ${section.name}`}
        title={`Drag ${section.name}`}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <Icon className="w-4 h-4 text-slate-700" />
      <span className="flex-1 text-sm text-slate-800">{section.name}</span>
      <button
        type="button"
        onClick={() => onToggle(section.id)}
        className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100"
        aria-label={section.enabled ? `Hide ${section.name}` : `Show ${section.name}`}
        title={section.enabled ? `Hide ${section.name}` : `Show ${section.name}`}
      >
        {section.enabled ? (
          <Eye className="w-4 h-4 text-slate-600" />
        ) : (
          <EyeOff className="w-4 h-4 text-slate-400" />
        )}
      </button>
    </div>
  );
}

export function LayoutSidebar({ sections, onReorder, onToggle, onPageBreakToggle }: LayoutSidebarProps) {
  const ids = useMemo(() => sections.map((s) => s.id), [sections]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <div className="space-y-1">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          const activeId = String(event.active.id);
          const overId = event.over?.id ? String(event.over.id) : null;
          if (!overId || activeId === overId) return;
          const oldIndex = sections.findIndex((s) => s.id === activeId);
          const newIndex = sections.findIndex((s) => s.id === overId);
          if (oldIndex < 0 || newIndex < 0) return;
          onReorder(arrayMove(sections, oldIndex, newIndex));
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {sections.map((section) => (
            <div key={section.id} className="space-y-2">
              <SortableRow section={section} active={false} onToggle={onToggle} />
              {section.pageBreakAfter ? (
                <button
                  type="button"
                  className="w-full flex items-center gap-2 my-2 cursor-pointer hover:opacity-80"
                  onClick={() => onPageBreakToggle(section.id)}
                >
                  <div className="flex-1 border-t-2 border-dashed border-red-400" />
                  <span className="text-xs font-medium text-red-500 uppercase px-2 py-1 border border-dashed border-red-400 rounded">
                    Page Break
                  </span>
                  <div className="flex-1 border-t-2 border-dashed border-red-400" />
                </button>
              ) : (
                <button
                  type="button"
                  className="w-full flex items-center justify-center text-xs text-slate-500 hover:text-slate-700"
                  onClick={() => onPageBreakToggle(section.id)}
                >
                  Add page break
                </button>
              )}
            </div>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

