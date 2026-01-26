/**
 * TagManagementPage — Canonical List + Inspector (R.10)
 *
 * DESIGN PHILOSOPHY (R.10 Delta)
 * ================================
 * This page transforms the Library → Tags view into a workspace-style experience
 * following the Profiles/Locations canonical model:
 *
 * LAYOUT:
 * - TOP: Header band with page title and primary actions
 * - LEFT: Scannable tag rail with search results
 * - RIGHT: Selected tag detail canvas (Inspector)
 *
 * KEY CHANGES FROM LEGACY:
 * 1. List + Inspector pattern replaces modal-first UX for editing
 * 2. Tag selection is local state (no URL routing)
 * 3. Inline editing for tag name and color
 * 4. Merge and Delete remain as modals (bulk/destructive actions)
 *
 * R.10 STANDARDIZATION:
 * - Inline editing in the Inspector (canvas) — NO modals for primary editing
 * - Click field → edit inline
 * - Blur/Enter → save
 * - Escape → cancel
 * - Matches Profiles (R.5–R.7) and Locations (R.9) behavior
 *
 * DATA SOURCE:
 * - Tags are aggregated from shots in the current project
 * - Project-scoped via ProjectScopeContext
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from "../lib/demoSafeFirestore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import Modal from "../components/ui/modal";
import { Tag, Search, Merge, Trash2, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { db } from "../lib/firebase";
import { shotsPath as getShotsPath } from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { useProjectScope } from "../context/ProjectScopeContext";
import { canManageShots, resolveEffectiveRole } from "../lib/rbac";
import { toast } from "../lib/toast";
import { describeFirebaseError } from "../lib/firebaseErrors";
import {
  TAG_COLORS,
  TagBadge,
  getTagSwatchClasses,
} from "../components/ui/TagBadge";
import { DEFAULT_TAGS, DEFAULT_TAG_GROUPS } from "../lib/defaultTags";
import InlineEditField from "../components/profiles/InlineEditField";

const PROJECT_GROUP_ID = "project";
const PROJECT_GROUP_LABEL = "Project Tags";
const DEFAULT_TAG_INDEX = new Map(DEFAULT_TAGS.map((tag) => [tag.id, tag]));
const DEFAULT_GROUP_LABELS = new Map(
  DEFAULT_TAG_GROUPS.map((group) => [group.id, group.label])
);
const DEFAULT_GROUP_DESCRIPTIONS = new Map(
  DEFAULT_TAG_GROUPS.map((group) => [group.id, group.description])
);

// ============================================================================
// TAG RAIL ITEM
// ============================================================================

function TagRailItem({ tag, isSelected, onClick, isSelectedForMerge, onToggleMerge, canEdit }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left p-3 rounded-lg transition-all duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1
        ${isSelected
          ? "bg-slate-100 dark:bg-slate-700 shadow-sm"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Merge checkbox */}
        {canEdit && (
          <div className="flex-shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              checked={isSelectedForMerge}
              onChange={(e) => {
                e.stopPropagation();
                onToggleMerge(tag.id);
              }}
              aria-label={`Select ${tag.label} for merge`}
            />
          </div>
        )}

        {/* Color swatch */}
        <div className="flex-shrink-0">
          <span
            className={`inline-block h-8 w-8 rounded-md border ${getTagSwatchClasses(tag.color)}`}
            aria-label={tag.color}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium truncate ${
              isSelected
                ? "text-slate-900 dark:text-slate-100"
                : "text-slate-700 dark:text-slate-300"
            }`}>
              {tag.label}
            </p>
            {tag.isDefault && (
              <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                Default
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {tag.usageCount} {tag.usageCount === 1 ? "shot" : "shots"}
          </p>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// TAG RAIL (LEFT PANEL)
// ============================================================================

function TagRail({
  tags,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  loading,
  selectedForMerge,
  onToggleMerge,
  canEdit,
}) {
  return (
    <aside className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col overflow-hidden">
      {/* Search header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Tag list */}
      <div className="flex-1 overflow-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
              <Tag className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              {searchQuery ? "No matches found" : "No tags yet"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              {searchQuery
                ? "Try a different search term"
                : "Tags appear when added to shots"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {tags.map((tag) => (
              <TagRailItem
                key={tag.id}
                tag={tag}
                isSelected={selectedId === tag.id}
                onClick={() => onSelect(tag.id)}
                isSelectedForMerge={selectedForMerge.includes(tag.id)}
                onToggleMerge={onToggleMerge}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Count footer */}
      {!loading && tags.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {tags.length} {tags.length === 1 ? "tag" : "tags"}
          </p>
        </div>
      )}
    </aside>
  );
}

// ============================================================================
// SUMMARY METRICS BAND
// ============================================================================

function MetricSlot({ icon: Icon, label, value, variant = "default" }) {
  const variantStyles = {
    default: "text-slate-600 dark:text-slate-300",
    muted: "text-slate-400 dark:text-slate-500",
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Icon className={`w-4 h-4 flex-shrink-0 ${variantStyles[variant]} opacity-60`} />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <p className={`text-sm font-semibold truncate ${variantStyles[variant]}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function TagSummaryBand({ tag }) {
  return (
    <div className="flex items-center divide-x divide-slate-100 dark:divide-slate-700 border border-slate-100 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
      <MetricSlot
        icon={TrendingUp}
        label="Usage"
        value={`${tag.usageCount} shots`}
      />
      {tag.groupLabel && (
        <MetricSlot
          icon={Tag}
          label="Category"
          value={tag.groupLabel}
        />
      )}
    </div>
  );
}

// ============================================================================
// COLOR PICKER (Inline)
// ============================================================================

function InlineColorPicker({ value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = useCallback((color) => {
    onChange(color);
    setIsOpen(false);
  }, [onChange]);

  if (disabled) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={`h-6 w-6 rounded-md border ${getTagSwatchClasses(value)}`}
          aria-label={value}
        />
        <span className="text-sm text-slate-600 dark:text-slate-300 capitalize">
          {value || "gray"}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 -mx-2.5 -my-1.5 rounded-lg hover:bg-slate-100/80 dark:hover:bg-slate-700/40 transition-all duration-150"
        title="Click to change color"
      >
        <span
          className={`h-6 w-6 rounded-md border ${getTagSwatchClasses(value)}`}
          aria-label={value}
        />
        <span className="text-sm text-slate-600 dark:text-slate-300 capitalize">
          {value || "gray"}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          {/* Picker dropdown */}
          <div className="absolute top-full left-0 mt-2 z-20 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="grid grid-cols-6 gap-2">
              {Object.keys(TAG_COLORS).map((color) => {
                const swatchClasses = getTagSwatchClasses(color);
                const isSelected = value === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleSelect(color)}
                    className={`h-8 w-8 rounded-md border-2 transition ${swatchClasses} ${
                      isSelected
                        ? "border-slate-900 dark:border-slate-100 ring-2 ring-slate-900 dark:ring-slate-100 ring-offset-2"
                        : "border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                    title={color}
                    aria-label={`Select ${color} color`}
                  >
                    <span className="sr-only">{color}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// TAG DETAIL CANVAS (RIGHT PANEL) — R.10 Inspector Pattern
// ============================================================================

function TagDetailCanvas({ tag, canEdit, onUpdateLabel, onUpdateColor, onDelete, navigate }) {
  if (!tag) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <Tag className="w-8 h-8 text-slate-300 dark:text-slate-500" />
          </div>
          <h2 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
            Select a tag
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Choose a tag from the list to view its details and edit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* ════════════════════════════════════════════════════════════════
            WORKSPACE STAGE CONTAINER (matches ProfileCanvas R.7)
            ════════════════════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">

          {/* ══════════════════════════════════════════════════════════════
              HERO / IDENTITY BLOCK
              ══════════════════════════════════════════════════════════════ */}
          <div className="p-6 pb-4">
            {/* Type badge */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                Tag
              </span>
              {tag.isDefault && (
                <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  Default
                </span>
              )}
              {!canEdit && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  View only
                </span>
              )}
            </div>

            {/* Hero color swatch */}
            <div className="flex justify-center mb-5">
              <div className={`w-24 h-24 rounded-2xl border-2 ${getTagSwatchClasses(tag.color)}`} />
            </div>

            {/* Name — hero typographic anchor (inline editable) */}
            <div className="text-center mb-4">
              {canEdit && onUpdateLabel ? (
                <InlineEditField
                  value={tag.label}
                  onSave={onUpdateLabel}
                  placeholder="Enter tag name"
                  className="text-xl font-semibold text-slate-900 dark:text-slate-100 justify-center"
                  inputClassName="text-xl font-semibold text-center"
                />
              ) : (
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {tag.label}
                </h1>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════
                SUMMARY METRICS BAND
                ══════════════════════════════════════════════════════════════ */}
            <TagSummaryBand tag={tag} />
          </div>

          {/* ══════════════════════════════════════════════════════════════
              DETAILS SECTION — Inline Editable Fields
              ══════════════════════════════════════════════════════════════ */}
          <div className="border-t border-slate-100 dark:border-slate-700 px-6 py-5">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
              Appearance
            </h3>
            <div className="space-y-4">
              <div className="py-2">
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Color
                </p>
                <InlineColorPicker
                  value={tag.color || "gray"}
                  onChange={onUpdateColor}
                  disabled={!canEdit}
                />
              </div>
              <div className="py-2">
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Preview
                </p>
                <TagBadge tag={tag} />
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              METADATA SECTION
              ══════════════════════════════════════════════════════════════ */}
          <div className="border-t border-slate-100 dark:border-slate-700 px-6 py-5">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
              Usage
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">Shots using this tag</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {tag.usageCount}
                </span>
              </div>
              {tag.groupLabel && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Category</span>
                  <span className="text-sm text-slate-900 dark:text-slate-100">
                    {tag.groupLabel}
                  </span>
                </div>
              )}
              {tag.groupDescription && (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  {tag.groupDescription}
                </p>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              DANGER ZONE — Delete
              ══════════════════════════════════════════════════════════════ */}
          {canEdit && !tag.isDefault && tag.usageCount > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-700 px-6 py-5">
              <h3 className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider mb-4">
                Danger Zone
              </h3>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                className="gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Delete Tag
              </Button>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                This will remove the tag from {tag.usageCount} {tag.usageCount === 1 ? "shot" : "shots"}.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ============================================================================
// HEADER BAND
// ============================================================================

function TagsHeaderBand({ canEdit, tagCount, selectedForMerge, onMergeClick }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Title + count */}
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Tags
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage tags used across shots in this project
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {tagCount > 0 && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {tagCount} {tagCount === 1 ? "tag" : "tags"}
              </span>
            )}
            {canEdit && selectedForMerge.length >= 2 && (
              <Button onClick={onMergeClick} variant="outline" className="gap-1.5">
                <Merge className="w-4 h-4" />
                Merge ({selectedForMerge.length})
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// FULL-PAGE EMPTY STATE
// ============================================================================

function TagsEmptyState({ navigate }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-800">
      <div className="text-center max-w-md px-4">
        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-6">
          <Tag className="w-10 h-10 text-slate-300 dark:text-slate-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
          No tags yet
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Tags are created when you add them to shots. Visit the Shots page to create and assign tags.
        </p>
        <Button onClick={() => navigate("/shots")} className="gap-1.5">
          Go to Shots
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function TagManagementPage() {
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedForMerge, setSelectedForMerge] = useState([]);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const { currentProjectId, ready: scopeReady, setLastVisitedPath } = useProjectScope();
  const redirectNotifiedRef = useRef(false);
  const projectId = currentProjectId;
  const { clientId, role: globalRole, projectRoles = {} } = useAuth();
  const userRole = useMemo(
    () => resolveEffectiveRole(globalRole, projectRoles, projectId),
    [globalRole, projectRoles, projectId]
  );
  const canEdit = canManageShots(userRole);
  const currentShotsPath = useMemo(() => getShotsPath(clientId), [clientId]);

  useEffect(() => {
    setLastVisitedPath("/tags");
  }, [setLastVisitedPath]);

  useEffect(() => {
    if (!scopeReady) return;
    if (!projectId) {
      if (!redirectNotifiedRef.current) {
        redirectNotifiedRef.current = true;
        toast.info({ title: "Please select a project" });
      }
      navigate("/projects", { replace: true });
      return;
    }
    redirectNotifiedRef.current = false;
  }, [scopeReady, projectId, navigate]);

  // Subscribe to shots in current project
  useEffect(() => {
    if (!scopeReady || !projectId) {
      setShots([]);
      setLoading(false);
      return undefined;
    }

    const scopedShotsQuery = query(
      collection(db, ...currentShotsPath),
      where("projectId", "==", projectId),
      where("deleted", "==", false)
    );

    const unsubShots = onSnapshot(
      scopedShotsQuery,
      (snapshot) => {
        const shotsData = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setShots(shotsData);
        setLoading(false);
      },
      (error) => {
        const { code, message } = describeFirebaseError(error, "Unable to load shots.");
        console.error("[Tags] Failed to subscribe to shots", error);
        toast.error({ title: "Failed to load shots", description: `${code}: ${message}` });
        setShots([]);
        setLoading(false);
      }
    );

    return () => unsubShots();
  }, [scopeReady, projectId, currentShotsPath]);

  // Aggregate tags from all shots
  const tagLibrary = useMemo(() => {
    const tagMap = new Map();

    DEFAULT_TAGS.forEach((tag) => {
      tagMap.set(tag.id, {
        id: tag.id,
        label: tag.label,
        color: tag.color,
        usageCount: 0,
        shotIds: [],
        groupId: tag.groupId,
        groupLabel: tag.groupLabel,
        groupDescription: tag.groupDescription,
        isDefault: true,
      });
    });

    shots.forEach((shot) => {
      if (!Array.isArray(shot.tags)) return;

      shot.tags.forEach((tag) => {
        if (!tag || !tag.id || !tag.label) return;

        const trimmedLabel = String(tag.label).trim();
        if (!trimmedLabel) return;

        const defaultTag = DEFAULT_TAG_INDEX.get(tag.id) || null;
        const groupId = tag.groupId || defaultTag?.groupId || PROJECT_GROUP_ID;
        const groupLabel = tag.groupLabel
          || defaultTag?.groupLabel
          || DEFAULT_GROUP_LABELS.get(groupId)
          || (groupId === PROJECT_GROUP_ID ? PROJECT_GROUP_LABEL : null);
        const groupDescription = tag.groupDescription
          || defaultTag?.groupDescription
          || DEFAULT_GROUP_DESCRIPTIONS.get(groupId)
          || null;
        const color = tag.color || defaultTag?.color || "gray";
        const isDefault = Boolean(tag.isDefault || defaultTag?.isDefault);

        if (tagMap.has(tag.id)) {
          const existing = tagMap.get(tag.id);
          tagMap.set(tag.id, {
            ...existing,
            label: trimmedLabel || existing.label,
            color,
            usageCount: existing.usageCount + 1,
            shotIds: [...existing.shotIds, shot.id],
            groupId: groupId || existing.groupId,
            groupLabel: groupLabel || existing.groupLabel,
            groupDescription:
              groupDescription ?? existing.groupDescription ?? null,
            isDefault: existing.isDefault || isDefault,
          });
        } else {
          tagMap.set(tag.id, {
            id: tag.id,
            label: trimmedLabel,
            color,
            usageCount: 1,
            shotIds: [shot.id],
            groupId,
            groupLabel,
            groupDescription,
            isDefault,
          });
        }
      });
    });

    return Array.from(tagMap.values()).sort((a, b) => {
      // Sort by usage count (descending), then by label
      if (b.usageCount !== a.usageCount) {
        return b.usageCount - a.usageCount;
      }
      return a.label.localeCompare(b.label);
    });
  }, [shots]);

  // Filter tags based on search
  const filteredTags = useMemo(() => {
    if (!searchText.trim()) return tagLibrary;
    const term = searchText.trim().toLowerCase();
    return tagLibrary.filter((tag) => tag.label.toLowerCase().includes(term));
  }, [tagLibrary, searchText]);

  // Selected tag
  const selectedTag = useMemo(() => {
    if (!selectedId) return null;
    return tagLibrary.find((tag) => tag.id === selectedId) || null;
  }, [tagLibrary, selectedId]);

  // Auto-select first tag when data loads and nothing is selected
  useEffect(() => {
    if (!loading && tagLibrary.length > 0 && !selectedId) {
      setSelectedId(tagLibrary[0].id);
    }
  }, [loading, tagLibrary, selectedId]);

  // Clear selection if selected tag was removed
  useEffect(() => {
    if (selectedId && !tagLibrary.find((tag) => tag.id === selectedId)) {
      setSelectedId(tagLibrary.length > 0 ? tagLibrary[0].id : null);
    }
  }, [tagLibrary, selectedId]);

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE HANDLERS (R.10 — Inline Edit)
  // ══════════════════════════════════════════════════════════════════════════

  const handleUpdateTagLabel = useCallback(async (newLabel) => {
    if (!canEdit || !selectedTag) return;

    const trimmedLabel = (newLabel || "").trim();
    if (!trimmedLabel) {
      throw new Error("Tag label cannot be empty");
    }
    if (trimmedLabel.length > 50) {
      throw new Error("Tag label must be 50 characters or less");
    }

    // Find all shots that have this tag
    const shotsToUpdate = shots.filter((shot) =>
      Array.isArray(shot.tags) && shot.tags.some((tag) => tag.id === selectedTag.id)
    );

    if (shotsToUpdate.length === 0) {
      toast.info("No shots use this tag.");
      return;
    }

    try {
      // Create batches (500 operations max per batch)
      let batch = writeBatch(db);
      let updateCount = 0;

      for (const shot of shotsToUpdate) {
        const updatedTags = shot.tags.map((tag) =>
          tag.id === selectedTag.id
            ? { ...tag, label: trimmedLabel }
            : tag
        );

        const shotDocRef = doc(db, ...currentShotsPath, shot.id);
        batch.update(shotDocRef, { tags: updatedTags });
        updateCount++;

        // Commit every 500 operations
        if (updateCount === 500) {
          await batch.commit();
          batch = writeBatch(db);
          updateCount = 0;
        }
      }

      // Commit remaining
      if (updateCount > 0) {
        await batch.commit();
      }

      toast.success(`Tag renamed to "${trimmedLabel}"`);
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to rename tag.");
      console.error("[Tags] Failed to rename tag", error);
      throw new Error(`${code}: ${message}`);
    }
  }, [canEdit, selectedTag, shots, currentShotsPath]);

  const handleUpdateTagColor = useCallback(async (newColor) => {
    if (!canEdit || !selectedTag) return;

    // Find all shots that have this tag
    const shotsToUpdate = shots.filter((shot) =>
      Array.isArray(shot.tags) && shot.tags.some((tag) => tag.id === selectedTag.id)
    );

    if (shotsToUpdate.length === 0) {
      toast.info("No shots use this tag.");
      return;
    }

    try {
      // Create batches (500 operations max per batch)
      let batch = writeBatch(db);
      let updateCount = 0;

      for (const shot of shotsToUpdate) {
        const updatedTags = shot.tags.map((tag) =>
          tag.id === selectedTag.id
            ? { ...tag, color: newColor }
            : tag
        );

        const shotDocRef = doc(db, ...currentShotsPath, shot.id);
        batch.update(shotDocRef, { tags: updatedTags });
        updateCount++;

        // Commit every 500 operations
        if (updateCount === 500) {
          await batch.commit();
          batch = writeBatch(db);
          updateCount = 0;
        }
      }

      // Commit remaining
      if (updateCount > 0) {
        await batch.commit();
      }

      toast.success("Tag color updated");
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to update tag color.");
      console.error("[Tags] Failed to update tag color", error);
      toast.error({ title: "Failed to update", description: `${code}: ${message}` });
    }
  }, [canEdit, selectedTag, shots, currentShotsPath]);

  // Toggle tag selection for merge
  const toggleMergeSelection = useCallback((tagId) => {
    setSelectedForMerge((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  // Merge tags
  const handleMergeTags = useCallback(async () => {
    if (!canEdit) {
      toast.error("You do not have permission to merge tags.");
      return;
    }

    if (selectedForMerge.length < 2) {
      toast.error("Select at least 2 tags to merge.");
      return;
    }

    setIsMerging(true);
    try {
      // Use the first selected tag as the target
      const [targetTag, ...tagsToMerge] = selectedForMerge.map((id) =>
        tagLibrary.find((tag) => tag.id === id)
      ).filter(Boolean);

      if (!targetTag) {
        toast.error("Invalid tag selection.");
        return;
      }

      const mergeIds = new Set(tagsToMerge.map((tag) => tag.id));

      // Find all shots that have any of the tags to merge
      const shotsToUpdate = shots.filter((shot) =>
        Array.isArray(shot.tags) && shot.tags.some((tag) => mergeIds.has(tag.id))
      );

      if (shotsToUpdate.length === 0) {
        toast.info("No shots use these tags.");
        setMergeModalOpen(false);
        return;
      }

      // Create batches
      let batch = writeBatch(db);
      let updateCount = 0;

      for (const shot of shotsToUpdate) {
        // Remove merged tags and add target tag if not already present
        const existingTargetTag = shot.tags.find((tag) => tag.id === targetTag.id);
        const filteredTags = shot.tags.filter((tag) => !mergeIds.has(tag.id));

        // Add target tag if not present
        if (!existingTargetTag) {
          filteredTags.push({
            id: targetTag.id,
            label: targetTag.label,
            color: targetTag.color,
          });
        }

        const shotDocRef = doc(db, ...currentShotsPath, shot.id);
        batch.update(shotDocRef, { tags: filteredTags });
        updateCount++;

        // Commit every 500 operations
        if (updateCount === 500) {
          await batch.commit();
          batch = writeBatch(db);
          updateCount = 0;
        }
      }

      // Commit remaining
      if (updateCount > 0) {
        await batch.commit();
      }

      toast.success(
        `Merged ${selectedForMerge.length} tags into "${targetTag.label}"`
      );
      setMergeModalOpen(false);
      setSelectedForMerge([]);
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to merge tags.");
      console.error("[Tags] Failed to merge tags", error);
      toast.error({ title: "Failed to merge tags", description: `${code}: ${message}` });
    } finally {
      setIsMerging(false);
    }
  }, [canEdit, selectedForMerge, tagLibrary, shots, currentShotsPath]);

  // Delete tag
  const handleDeleteTag = useCallback(async () => {
    if (!canEdit) {
      toast.error("You do not have permission to delete tags.");
      return;
    }

    if (!tagToDelete) return;

    setIsDeleting(true);
    try {
      // Find all shots that have this tag
      const shotsToUpdate = shots.filter((shot) =>
        Array.isArray(shot.tags) && shot.tags.some((tag) => tag.id === tagToDelete.id)
      );

      if (shotsToUpdate.length === 0) {
        toast.info("No shots use this tag.");
        setDeleteModalOpen(false);
        return;
      }

      // Create batches
      let batch = writeBatch(db);
      let updateCount = 0;

      for (const shot of shotsToUpdate) {
        const filteredTags = shot.tags.filter((tag) => tag.id !== tagToDelete.id);

        const shotDocRef = doc(db, ...currentShotsPath, shot.id);
        batch.update(shotDocRef, { tags: filteredTags });
        updateCount++;

        // Commit every 500 operations
        if (updateCount === 500) {
          await batch.commit();
          batch = writeBatch(db);
          updateCount = 0;
        }
      }

      // Commit remaining
      if (updateCount > 0) {
        await batch.commit();
      }

      toast.success(`Deleted tag "${tagToDelete.label}"`);
      setDeleteModalOpen(false);
      setTagToDelete(null);
      // Clear selection if we deleted the selected tag
      if (selectedId === tagToDelete.id) {
        setSelectedId(null);
      }
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to delete tag.");
      console.error("[Tags] Failed to delete tag", error);
      toast.error({ title: "Failed to delete tag", description: `${code}: ${message}` });
    } finally {
      setIsDeleting(false);
    }
  }, [canEdit, tagToDelete, shots, currentShotsPath, selectedId]);

  // Open delete modal from Inspector
  const openDeleteModal = useCallback(() => {
    if (!canEdit || !selectedTag) return;
    if (selectedTag.isDefault) {
      toast.info("Default tags are always available and can't be deleted.");
      return;
    }
    setTagToDelete(selectedTag);
    setDeleteModalOpen(true);
  }, [canEdit, selectedTag]);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  // Loading state
  if (loading && shots.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Loading tags...
          </p>
        </div>
      </div>
    );
  }

  // Empty state (no tags at all)
  if (!loading && tagLibrary.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
        <TagsHeaderBand
          canEdit={canEdit}
          tagCount={0}
          selectedForMerge={selectedForMerge}
          onMergeClick={() => setMergeModalOpen(true)}
        />
        <TagsEmptyState navigate={navigate} />
      </div>
    );
  }

  // Main workspace layout
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header band */}
      <TagsHeaderBand
        canEdit={canEdit}
        tagCount={tagLibrary.length}
        selectedForMerge={selectedForMerge}
        onMergeClick={() => setMergeModalOpen(true)}
      />

      {/* Workspace: Rail + Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left rail */}
        <TagRail
          tags={filteredTags}
          selectedId={selectedId}
          onSelect={setSelectedId}
          searchQuery={searchText}
          onSearchChange={setSearchText}
          loading={false}
          selectedForMerge={selectedForMerge}
          onToggleMerge={toggleMergeSelection}
          canEdit={canEdit}
        />

        {/* Right canvas (Inspector) */}
        <TagDetailCanvas
          tag={selectedTag}
          canEdit={canEdit}
          onUpdateLabel={handleUpdateTagLabel}
          onUpdateColor={handleUpdateTagColor}
          onDelete={openDeleteModal}
          navigate={navigate}
        />
      </div>

      {/* Merge Modal */}
      {canEdit && mergeModalOpen && (
        <Modal
          open={mergeModalOpen}
          onClose={() => {
            if (isMerging) return;
            setMergeModalOpen(false);
          }}
          labelledBy="merge-tags-title"
          closeOnOverlay={!isMerging}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100" id="merge-tags-title">
                Merge Tags
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Merge {selectedForMerge.length} selected tags into one. The first selected tag will be kept.
              </p>
            </div>
            <div className="flex-1 px-6 py-4 space-y-4">
              {selectedForMerge.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Select at least 2 tags from the list to merge them.
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tags to merge:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedForMerge.map((tagId) => {
                        const tag = tagLibrary.find((t) => t.id === tagId);
                        return tag ? <TagBadge key={tagId} tag={tag} /> : null;
                      })}
                    </div>
                  </div>
                  <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Note:</strong> The first selected tag will be kept. All other tags will be replaced with it
                      across all shots.
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMergeModalOpen(false)}
                disabled={isMerging}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleMergeTags}
                disabled={isMerging || selectedForMerge.length < 2}
              >
                {isMerging ? "Merging..." : "Merge Tags"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      {canEdit && deleteModalOpen && tagToDelete && (
        <Modal
          open={deleteModalOpen}
          onClose={() => {
            if (isDeleting) return;
            setDeleteModalOpen(false);
            setTagToDelete(null);
          }}
          labelledBy="delete-tag-title"
          closeOnOverlay={!isDeleting}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100" id="delete-tag-title">
                Delete Tag
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                This will remove the tag from all {tagToDelete.usageCount} shots.
              </p>
            </div>
            <div className="flex-1 px-6 py-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tag to delete:</p>
                <TagBadge tag={tagToDelete} />
              </div>
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Warning:</strong> This action cannot be undone. The tag will be permanently removed from all shots.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setTagToDelete(null);
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteTag}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Tag"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
