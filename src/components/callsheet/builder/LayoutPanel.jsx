import React, { useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff, Plus, MoreHorizontal, Pencil } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Modal } from "../../ui/modal";
import TemplatesModal from "../modals/TemplatesModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

function sectionLabel(type) {
  const labels = {
    header: "Header",
    "day-details": "Day Details",
    reminders: "Reminders",
    schedule: "Schedule",
    clients: "Clients",
    talent: "Talent",
    extras: "Extras",
    "advanced-schedule": "Advanced Schedule",
    "page-break": "Page Break",
    crew: "Crew",
    "notes-contacts": "Notes / Contacts",
    "custom-banner": "Custom Banner",
    quote: "Quote of the Day",
  };
  return labels[type] || type;
}

function SortableSectionItem({ section, isActive, onClick, onToggle, onDelete, onAddBannerBelow, onAddPageBreakBelow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const visible = section.isVisible !== false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "group flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors",
        isActive
          ? "border-blue-300 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
        visible ? "" : "opacity-60",
      ].join(" ")}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-70 group-hover:opacity-100 transition-opacity"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${sectionLabel(section.type)}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => onClick(section.id)}
        className="flex-1 min-w-0 text-left"
      >
        <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {sectionLabel(section.type)}
        </div>
        {visible ? null : (
          <div className="mt-0.5 text-[11px] font-medium text-slate-500">
            Disabled
          </div>
        )}
        {section.type === "custom-banner" && section.config?.text ? (
          <div className="truncate text-xs text-slate-500">{String(section.config.text)}</div>
        ) : null}
      </button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        onClick={() => onClick(section.id)}
        aria-label="Edit section"
        title="Edit section"
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <button
        type="button"
        onClick={() => onToggle(section.id, !visible)}
        className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        aria-label={visible ? "Hide section" : "Show section"}
        title={visible ? "Hide section" : "Show section"}
      >
        {visible ? <Eye className="h-4 w-4 text-blue-600" /> : <EyeOff className="h-4 w-4" />}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            aria-label="Section actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onAddBannerBelow?.(section.id)}>
            Add banner below…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddPageBreakBelow?.(section.id)}>
            Add page break below
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDelete(section.id)}
            disabled={["header", "schedule"].includes(section.type)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function LayoutPanel({
  sections,
  activeSectionId,
  onSelectSection,
  onReorderSections,
  onToggleSection,
  onAddSection,
  onDeleteSection,
  title = "Outline",
}) {
  const orderedSections = useMemo(() => {
    return [...(sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [sections]);

  const [hideDisabled, setHideDisabled] = useState(() => {
    try {
      const stored = localStorage.getItem("callSheetOutline.hideDisabled");
      if (stored == null) return false;
      return stored === "true";
    } catch {
      return false;
    }
  });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isAddBannerOpen, setIsAddBannerOpen] = useState(false);
  const [bannerText, setBannerText] = useState("Banner");
  const [bannerAfterId, setBannerAfterId] = useState(null);
  const bannerInputRef = useRef(null);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedSections.findIndex((s) => s.id === active.id);
    const newIndex = orderedSections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orderedSections, oldIndex, newIndex).map((s, idx) => ({
      ...s,
      order: idx,
    }));
    onReorderSections(next);
  };

  const visibleSections = useMemo(() => {
    if (!hideDisabled) return orderedSections;
    return orderedSections.filter((section) => {
      if (section.id === activeSectionId) return true;
      return section.isVisible !== false;
    });
  }, [activeSectionId, hideDisabled, orderedSections]);

  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={() => setIsTemplatesOpen(true)}>
            Load / Save
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setBannerText("Banner");
                  setBannerAfterId(null);
                  setIsAddBannerOpen(true);
                }}
              >
                Custom banner…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddSection("page-break")}>Page break</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddSection("reminders")}>Reminders</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddSection("extras")}>Extras & Dept. Notes</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddSection("advanced-schedule")}>Advanced Schedule</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddSection("quote")}>Quote of the Day</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddSection("notes-contacts")}>
                Notes / Contacts
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {visibleSections.map((section) => (
              <SortableSectionItem
                key={section.id}
                section={section}
                isActive={section.id === activeSectionId}
                onClick={onSelectSection}
                onToggle={onToggleSection}
                onAddBannerBelow={(afterId) => {
                  setBannerText("Banner");
                  setBannerAfterId(afterId);
                  setIsAddBannerOpen(true);
                }}
                onAddPageBreakBelow={(afterId) => onAddSection("page-break", {}, afterId)}
                onDelete={(sectionId) => {
                  const target = orderedSections.find((s) => s.id === sectionId);
                  if (!target) return;
                  if (["header", "schedule"].includes(target.type)) return;
                  setDeleteTarget(target);
                }}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <button
        type="button"
        className="text-left text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        onClick={() => {
          setHideDisabled((prev) => {
            const next = !prev;
            try {
              localStorage.setItem("callSheetOutline.hideDisabled", String(next));
            } catch {}
            return next;
          });
        }}
      >
        {hideDisabled ? "Show disabled sections" : "Hide disabled sections"}
      </button>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        labelledBy="callsheet-delete-section-title"
        describedBy="callsheet-delete-section-desc"
        contentClassName="!max-w-md !min-h-0"
        closeOnOverlay={false}
      >
        <div className="p-6">
          <div className="space-y-2">
            <div
              id="callsheet-delete-section-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Delete section?
            </div>
            <div
              id="callsheet-delete-section-desc"
              className="text-sm text-slate-600 dark:text-slate-400"
            >
              This removes <span className="font-medium">{sectionLabel(deleteTarget?.type)}</span> from the call sheet layout.
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (deleteTarget) onDeleteSection(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={isAddBannerOpen}
        onClose={() => setIsAddBannerOpen(false)}
        labelledBy="callsheet-add-banner-title"
        describedBy="callsheet-add-banner-desc"
        initialFocusRef={bannerInputRef}
        contentClassName="!max-w-md !min-h-0"
      >
        <div className="p-6">
          <div className="space-y-2">
            <div
              id="callsheet-add-banner-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Add custom banner
            </div>
            <div
              id="callsheet-add-banner-desc"
              className="text-sm text-slate-600 dark:text-slate-400"
            >
              Banner text appears between sections (useful for headers like “AFTER LUNCH”).
            </div>
          </div>

          <div className="mt-4">
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-slate-500">Text</span>
              <Input
                ref={bannerInputRef}
                value={bannerText}
                onChange={(e) => setBannerText(e.target.value)}
                placeholder="Banner"
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsAddBannerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const text = String(bannerText || "").trim() || "Banner";
                onAddSection("custom-banner", { text }, bannerAfterId);
                setIsAddBannerOpen(false);
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </Modal>

      <TemplatesModal open={isTemplatesOpen} onClose={() => setIsTemplatesOpen(false)} />
    </div>
  );
}
