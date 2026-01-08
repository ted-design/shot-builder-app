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
import {
  GripVertical,
  Eye,
  EyeOff,
  Plus,
  MoreHorizontal,
  ChevronRight,
  LayoutTemplate,
  Calendar,
  Bell,
  ClipboardList,
  Users,
  Star,
  StickyNote,
  ScrollText,
  FileText,
  MessageSquare,
  Wrench,
  Quote,
} from "lucide-react";
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

const SECTION_ICONS = {
  header: LayoutTemplate,
  "day-details": Calendar,
  reminders: Bell,
  schedule: ClipboardList,
  clients: Users,
  talent: Star,
  extras: StickyNote,
  "advanced-schedule": Wrench,
  "page-break": ScrollText,
  crew: Users,
  "notes-contacts": FileText,
  "custom-banner": MessageSquare,
  quote: Quote,
};

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
  };

  const visible = section.isVisible !== false;
  const Icon = SECTION_ICONS[section.type] || ClipboardList;
  const isPageBreak = section.type === "page-break";

  // Page break has a distinct red-tinted appearance
  if (isPageBreak) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={[
          "group relative flex items-center gap-2 rounded-lg px-3 py-2.5 min-h-11 transition-all duration-150 cursor-pointer border",
          isDragging ? "opacity-60 shadow-lg z-50" : "",
          isActive
            ? "bg-rose-600 text-white border-rose-600 shadow-md"
            : visible
              ? "bg-rose-50 border-rose-200 hover:bg-rose-100 hover:border-rose-300 dark:bg-rose-950/30 dark:border-rose-800 dark:hover:bg-rose-900/40"
              : "bg-slate-50 border-slate-200 opacity-50 hover:opacity-75 dark:bg-slate-800/50 dark:border-slate-700",
        ].join(" ")}
        onClick={() => onClick(section.id)}
      >
        {/* Drag handle */}
        <button
          type="button"
          className={[
            "cursor-grab active:cursor-grabbing flex-shrink-0 transition-opacity",
            isActive
              ? "text-white/60 hover:text-white"
              : "text-rose-400 hover:text-rose-600 dark:text-rose-500 dark:hover:text-rose-300",
          ].join(" ")}
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag page break"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {/* Dashed line indicator */}
        <div className="flex-1 flex items-center gap-2">
          <div className={[
            "flex-1 h-px border-t-2 border-dashed",
            isActive ? "border-white/50" : "border-rose-300 dark:border-rose-600"
          ].join(" ")} />
          <span className={[
            "text-[10px] font-bold uppercase tracking-wider px-1.5",
            isActive ? "text-white" : "text-rose-500 dark:text-rose-400"
          ].join(" ")}>
            Page Break
          </span>
          <div className={[
            "flex-1 h-px border-t-2 border-dashed",
            isActive ? "border-white/50" : "border-rose-300 dark:border-rose-600"
          ].join(" ")} />
        </div>

        {/* Visibility toggle for page break */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(section.id, !visible);
          }}
          className={[
            "inline-flex h-6 w-6 items-center justify-center rounded transition-all",
            isActive
              ? "text-white/70 hover:text-white hover:bg-white/10"
              : "opacity-0 group-hover:opacity-100 text-rose-500 hover:bg-rose-200 dark:hover:bg-rose-800",
          ].join(" ")}
          aria-label={visible ? "Hide page break" : "Show page break"}
          title={visible ? "Hide page break" : "Show page break"}
        >
          {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </button>

        {/* Delete via more menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={[
                "h-6 w-6 p-0 transition-all",
                isActive
                  ? "text-white/70 hover:text-white hover:bg-white/10"
                  : "opacity-0 group-hover:opacity-100 text-rose-500 hover:bg-rose-200 dark:hover:bg-rose-800",
              ].join(" ")}
              onClick={(e) => e.stopPropagation()}
              aria-label="Page break actions"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onDelete(section.id)}>
              Delete page break
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "group relative flex items-center gap-2 rounded-lg px-3 py-2.5 min-h-11 transition-all duration-150 cursor-pointer border",
        isDragging ? "opacity-60 shadow-lg z-50" : "",
        isActive
          ? "bg-gradient-to-r from-blue-700 to-indigo-600 text-white border-transparent shadow-md"
          : visible
            ? "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600"
            : "bg-slate-50 border-slate-200 opacity-60 hover:opacity-80 dark:bg-slate-800/50 dark:border-slate-700",
      ].join(" ")}
      onClick={() => onClick(section.id)}
    >
      {/* Drag handle - always visible but subtle */}
      <button
        type="button"
        className={[
          "cursor-grab active:cursor-grabbing flex-shrink-0 transition-colors",
          isActive
            ? "text-white/50 hover:text-white/80"
            : "text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400",
        ].join(" ")}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Drag ${sectionLabel(section.type)}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Section icon - prominent */}
      <div
        className={[
          "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg",
          isActive
            ? "bg-white/20 text-white"
            : visible
              ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500",
        ].join(" ")}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>

      {/* Label - given more space with better layout */}
      <div className="flex-1 min-w-0 pr-1">
        <div
          className={[
            "text-sm font-medium leading-tight",
            isActive ? "text-white" : visible ? "text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400",
          ].join(" ")}
          title={sectionLabel(section.type)}
        >
          {sectionLabel(section.type)}
        </div>
        {!visible && !isActive ? (
          <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-0.5">
            Hidden
          </div>
        ) : null}
        {section.type === "custom-banner" && section.config?.text ? (
          <div
            className={["text-xs leading-tight mt-0.5 truncate", isActive ? "text-white/70" : "text-slate-500 dark:text-slate-400"].join(" ")}
            title={String(section.config.text)}
          >
            {String(section.config.text)}
          </div>
        ) : null}
      </div>

      {/* Right side actions - more compact */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* Visibility toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(section.id, !visible);
          }}
          className={[
            "inline-flex h-7 w-7 items-center justify-center rounded-md transition-all",
            isActive
              ? "text-white/70 hover:text-white hover:bg-white/10"
              : "opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700",
          ].join(" ")}
          aria-label={visible ? "Hide section" : "Show section"}
          title={visible ? "Hide section" : "Show section"}
        >
          {visible ? (
            <Eye className={["h-3.5 w-3.5", isActive ? "" : "text-blue-600 dark:text-blue-400"].join(" ")} />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-slate-400" />
          )}
        </button>

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={[
                "h-7 w-7 p-0 transition-all",
                isActive
                  ? "text-white/70 hover:text-white hover:bg-white/10"
                  : "opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700",
              ].join(" ")}
              onClick={(e) => e.stopPropagation()}
              aria-label="Section actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
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

        {/* Chevron indicator */}
        <ChevronRight
          className={[
            "h-4 w-4 flex-shrink-0 transition-all",
            isActive ? "text-white/80" : "text-slate-400 opacity-0 group-hover:opacity-100 dark:text-slate-500",
          ].join(" ")}
        />
      </div>
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
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-50 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setIsTemplatesOpen(true)}
          >
            Load / Save
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-7 w-7">
                <Plus className="h-3.5 w-3.5" />
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

      {/* Section list */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
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

      {/* Footer */}
      <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <button
          type="button"
          className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
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
          {hideDisabled ? "Show hidden sections" : "Hide disabled sections"}
        </button>
      </div>

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
