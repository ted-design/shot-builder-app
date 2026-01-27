/**
 * LibraryTalentPage — R.17: Gallery Grid + Expand-Down Cockpit
 *
 * DESIGN PHILOSOPHY (R.17 Delta)
 * ==============================
 * This page transforms the Library → Talent view into a grid + cockpit experience
 * matching the Products and Palette (Swatches) spatial language:
 *
 * LAYOUT:
 * - TOP: Header band with page title, search, and primary actions
 * - MAIN: Gallery grid of talent tiles (image-first, scannable)
 * - BELOW GRID: Expand-down cockpit when a talent is selected
 *
 * KEY CHANGES FROM L.2/L.4:
 * 1. Replaced left rail (TalentRail) with a grid of TalentTile components
 * 2. Replaced right canvas (TalentDetailCanvas) with expand-down TalentCockpit
 * 3. Moved search to header band
 * 4. All L.4 content (edit modal, measurements) preserved in cockpit
 *
 * DATA SOURCE:
 * - Firestore: clients/{clientId}/talent (via talentPath)
 * - Real-time subscription via onSnapshot
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "../lib/demoSafeFirestore";
import { db, uploadImageFile, deleteImageByPath } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { talentPath } from "../lib/paths";
import { searchTalent } from "../lib/search";
import { canManageTalent } from "../lib/rbac";
import { normalizeMeasurementsMap, getMeasurementDisplayValue } from "../lib/measurements";
import { toast } from "../lib/toast";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import Thumb from "../components/Thumb";
import TalentCreateModal from "../components/talent/TalentCreateModal";
import TalentEditModal from "../components/talent/TalentEditModal";
import { nanoid } from "nanoid";
import {
  User,
  Phone,
  Mail,
  FileText,
  Plus,
  Search,
  ExternalLink,
  Ruler,
  Pencil,
  X,
} from "lucide-react";
import { stripHtml } from "../lib/stripHtml";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function buildDisplayName(talent) {
  // Prefer computed name field if it exists
  if (talent.name && talent.name.trim()) {
    return talent.name.trim();
  }
  // Fall back to firstName + lastName
  const first = (talent.firstName || "").trim();
  const last = (talent.lastName || "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || "Unnamed talent";
}

function formatContact(talent) {
  const parts = [];
  if (talent.phone) parts.push(talent.phone);
  if (talent.email) parts.push(talent.email);
  return parts.join(" • ");
}

function getNotesPreview(talent, maxLength = 120) {
  const raw = talent?.notes || talent?.sizing || "";
  const plain = stripHtml(raw);
  if (!plain) return "";
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trim()}…`;
}

// ============================================================================
// GALLERY HELPERS (L.4: Required for TalentEditModal save flow)
// ============================================================================

const normaliseGalleryOrder = (items = []) =>
  (Array.isArray(items) ? items : [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((item, index) => ({ ...item, order: index }));

const buildGalleryUpdate = async (talentId, nextAttachments = [], previousAttachments = []) => {
  const sortedNext = normaliseGalleryOrder(nextAttachments);
  const previousMap = new Map((previousAttachments || []).map((item) => [item.id, item]));

  // Prepare all items with metadata and identify which need uploads
  const preparedItems = sortedNext.map((attachment, index) => {
    const description = (attachment.description || "").trim();
    const cropData = attachment.cropData || null;
    const id = attachment.id || nanoid();
    return { attachment, index, description, cropData, id };
  });

  // Parallel upload for items with files
  const uploadPromises = preparedItems
    .filter((item) => item.attachment.file)
    .map(async (item) => {
      const baseName = item.attachment.file.name || `image-${item.id}.jpg`;
      const safeName = baseName.replace(/\s+/g, "_");
      const { path, downloadURL } = await uploadImageFile(item.attachment.file, {
        folder: "talent",
        id: talentId,
        filename: `${item.id}-${safeName}`,
      });
      return { ...item, path, downloadURL, uploaded: true };
    });

  const uploadResults = await Promise.all(uploadPromises);
  const uploadedMap = new Map(uploadResults.map((r) => [r.id, r]));

  // Build final gallery preserving order
  const finalGallery = [];
  for (const item of preparedItems) {
    const uploaded = uploadedMap.get(item.id);
    if (uploaded) {
      finalGallery.push({
        id: uploaded.id,
        path: uploaded.path,
        downloadURL: uploaded.downloadURL,
        description: uploaded.description,
        cropData: uploaded.cropData,
        order: uploaded.index,
      });
      continue;
    }

    // Existing item (no new file)
    const previous = previousMap.get(item.attachment.id) || {};
    const path = item.attachment.path || previous.path || null;
    const downloadURL = item.attachment.downloadURL || previous.downloadURL || path || null;
    if (!path && !downloadURL) continue;

    finalGallery.push({
      id: item.id,
      path,
      downloadURL,
      description: item.description,
      cropData: item.cropData ?? previous.cropData ?? null,
      order: item.index,
    });
  }

  const removed = (previousAttachments || []).filter((item) => !finalGallery.some((next) => next.id === item.id));

  return { finalGallery, removed };
};

// ============================================================================
// MEASUREMENTS DISPLAY HELPERS (L.4: Structured spec grid)
// ============================================================================

// Known measurement keys for display ordering
// TODO: Future — normalize measurements to numeric fields for range search (L.4 note)
const MEASUREMENT_DISPLAY_ORDER = [
  "height",
  "bust",
  "waist",
  "hips",
  "inseam",
  "collar",
  "sleeve",
  "dress",
  "shoes",
];

// Friendly labels for measurement keys
const MEASUREMENT_LABELS = {
  height: "Height",
  bust: "Bust",
  waist: "Waist",
  hips: "Hips",
  inseam: "Inseam",
  collar: "Collar",
  sleeve: "Sleeve",
  dress: "Dress Size",
  shoes: "Shoe Size",
};

function parseMeasurementsForDisplay(measurements) {
  if (!measurements || typeof measurements !== "object") return [];

  const entries = [];
  const seen = new Set();

  // First, add known keys in display order
  for (const key of MEASUREMENT_DISPLAY_ORDER) {
    if (Object.prototype.hasOwnProperty.call(measurements, key)) {
      const value = getMeasurementDisplayValue(key, measurements[key]);
      if (value) {
        entries.push({ key, label: MEASUREMENT_LABELS[key] || key, value });
        seen.add(key);
      }
    }
  }

  // Then, add any remaining keys not in the known list
  for (const [key, rawValue] of Object.entries(measurements)) {
    if (seen.has(key)) continue;
    const value = getMeasurementDisplayValue(key, rawValue);
    if (value) {
      // Capitalize first letter of unknown keys
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      entries.push({ key, label, value });
    }
  }

  return entries;
}

// ============================================================================
// TALENT TILE (Grid Item) — R.17
// ============================================================================

function TalentTile({ talent, isSelected, onClick, tileRef }) {
  const name = buildDisplayName(talent);
  const agency = (talent.agency || "").trim();
  const hasImage = Boolean(talent.headshotPath);

  return (
    <button
      ref={tileRef}
      type="button"
      onClick={onClick}
      className={`
        group relative flex flex-col items-center p-2 rounded-lg transition-all duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1
        ${isSelected
          ? "bg-slate-100 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-500 shadow-sm"
          : "border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700"
        }
      `}
      aria-pressed={isSelected}
      aria-label={`${name}${isSelected ? " (selected)" : ""}`}
    >
      {/* Portrait preview — taller aspect ratio for headshots */}
      <div className={`
        w-16 h-20 rounded-lg overflow-hidden transition-all bg-slate-100 dark:bg-slate-700
        ${isSelected ? "shadow-md" : "shadow-sm group-hover:shadow-md"}
      `}>
        {hasImage ? (
          <Thumb
            path={talent.headshotPath}
            alt={name}
            size={160}
            className="w-full h-full"
            imageClassName="w-full h-full object-cover object-top"
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-6 h-6 text-slate-300 dark:text-slate-500" />
              </div>
            }
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-6 h-6 text-slate-300 dark:text-slate-500" />
          </div>
        )}
      </div>

      {/* Name */}
      <p className={`
        mt-1.5 text-[11px] font-medium text-center truncate w-full max-w-[80px]
        ${isSelected ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}
      `}>
        {name}
      </p>

      {/* Agency badge */}
      {agency && (
        <span className="mt-0.5 text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-[80px]">
          {agency}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// TALENT COCKPIT (Expand-Down Panel) — R.17
// ============================================================================

function TalentCockpit({ talent, canManage, onEdit, onClose }) {
  if (!talent) return null;

  const name = buildDisplayName(talent);
  const agency = (talent.agency || "").trim();
  const notesContent = talent.notes || talent.sizing || "";
  const notesPlain = stripHtml(notesContent);
  const measurementEntries = parseMeasurementsForDisplay(talent.measurements);
  const hasMeasurements = measurementEntries.length > 0;

  return (
    <div className="mt-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</h3>
          <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
            Talent Workspace
          </span>
          {!canManage && (
            <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              View only
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-700 transition-colors"
          aria-label="Close detail panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Two-column layout: Identity | Content */}
      <div className="flex">
        {/* Left: Identity column */}
        <div className="flex-shrink-0 w-44 p-4 border-r border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
          {/* Hero portrait */}
          <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700">
            <Thumb
              path={talent.headshotPath || null}
              size={320}
              alt={name}
              className="w-full h-full"
              imageClassName="w-full h-full object-cover object-top"
              fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-12 h-12 text-slate-300 dark:text-slate-500" />
                </div>
              }
            />
          </div>

          {/* Agency */}
          {agency && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 text-center">
              {agency}
            </p>
          )}

          {/* Gender badge */}
          {talent.gender && (
            <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 text-center">
              {talent.gender}
            </p>
          )}
        </div>

        {/* Right: Content area */}
        <div className="flex-1 min-w-0 overflow-y-auto max-h-[min(60vh,560px)]">
          {/* Contact section */}
          <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-700">
            <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
              Contact
            </h4>
            <div className="space-y-3">
              {/* Phone */}
              {talent.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-900 dark:text-slate-100">
                    {talent.phone}
                  </span>
                </div>
              )}

              {/* Email */}
              {talent.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <a
                    href={`mailto:${talent.email}`}
                    className="text-sm text-primary hover:underline truncate"
                  >
                    {talent.email}
                  </a>
                </div>
              )}

              {/* Portfolio URL */}
              {talent.url && (
                <div className="flex items-center gap-3">
                  <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <a
                    href={talent.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline truncate"
                  >
                    {talent.url}
                  </a>
                </div>
              )}

              {/* No contact info */}
              {!talent.phone && !talent.email && !talent.url && (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                  No contact info
                </p>
              )}
            </div>
          </div>

          {/* Measurements section */}
          {hasMeasurements && (
            <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Ruler className="w-4 h-4 text-slate-400" />
                <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Measurements
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {measurementEntries.map(({ key, label, value }) => (
                  <div key={key} className="flex justify-between gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {label}
                    </span>
                    <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes section */}
          {notesPlain && (
            <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-slate-400" />
                <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Notes
                </h4>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {notesPlain}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="px-4 py-4">
            {canManage ? (
              <Button variant="secondary" size="sm" onClick={() => onEdit(talent)} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" />
                Edit talent
              </Button>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Only producers and admins can edit talent records.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HEADER BAND (with search) — R.17
// ============================================================================

function TalentHeaderBand({
  canManage,
  onCreateClick,
  talentCount,
  searchQuery,
  onSearchChange,
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Title */}
          <div className="flex-shrink-0">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Talent
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track models, their agencies, contact details, and wardrobe notes
            </p>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search talent..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {talentCount > 0 && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {talentCount} {talentCount === 1 ? "talent" : "talent"}
              </span>
            )}
            {canManage && (
              <Button onClick={onCreateClick} className="gap-1.5">
                <Plus className="w-4 h-4" />
                New talent
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

function TalentEmptyState({ canManage, onCreateClick }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-800">
      <div className="text-center max-w-md px-4">
        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-6">
          <User className="w-10 h-10 text-slate-300 dark:text-slate-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
          No talent yet
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Talent records help you keep track of models, their contact details,
          agencies, measurements, and wardrobe notes for your shoots.
        </p>
        {canManage ? (
          <Button onClick={onCreateClick} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add your first talent
          </Button>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Producers can create and manage talent records.
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// NO RESULTS STATE (for search) — R.17
// ============================================================================

function NoResultsState({ searchQuery }) {
  return (
    <div className="py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
        <Search className="w-6 h-6 text-slate-300 dark:text-slate-500" />
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
        No matches found for "{searchQuery}"
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-500">
        Try a different search term
      </p>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function LibraryTalentPage() {
  // Auth & permissions
  const { clientId, role: globalRole } = useAuth();
  const canManage = canManageTalent(globalRole);

  // Data state
  const [talent, setTalent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // L.4: Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  // R.17: Refs for tiles and cockpit
  const tileRefs = useRef({});
  const cockpitRef = useRef(null);

  // Firestore path
  const currentTalentPath = useMemo(() => talentPath(clientId), [clientId]);

  // ══════════════════════════════════════════════════════════════════════════
  // DATA FETCHING
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const qy = query(collection(db, ...currentTalentPath), orderBy("lastName", "asc"));

    const unsubscribe = onSnapshot(
      qy,
      (snapshot) => {
        const data = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }));
        setTalent(data);
        setLoading(false);
      },
      (err) => {
        console.error("[LibraryTalentPage] Error loading talent:", err);
        setError(err?.message || "Unable to load talent.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [clientId, currentTalentPath]);

  // ══════════════════════════════════════════════════════════════════════════
  // FILTERED TALENT
  // ══════════════════════════════════════════════════════════════════════════

  const filteredTalent = useMemo(() => {
    const term = searchQuery.trim();
    if (!term) return talent;
    const searchResults = searchTalent(talent, term);
    return searchResults.map((result) => result.item);
  }, [talent, searchQuery]);

  // ══════════════════════════════════════════════════════════════════════════
  // SELECTED TALENT
  // ══════════════════════════════════════════════════════════════════════════

  const selectedTalent = useMemo(() => {
    if (!selectedId) return null;
    return talent.find((t) => t.id === selectedId) || null;
  }, [talent, selectedId]);

  // Clear selection if selected talent was deleted
  useEffect(() => {
    if (selectedId && !talent.find((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  }, [talent, selectedId]);

  // R.17: Ref callback for each tile
  const setTileRef = useCallback((talentId) => (el) => {
    tileRefs.current[talentId] = el;
  }, []);

  // R.17: Scroll cockpit into view when opening
  useEffect(() => {
    if (!selectedId || !cockpitRef.current) return;

    let rafId1;
    let rafId2;

    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        const cockpit = cockpitRef.current;
        if (!cockpit) return;

        const rect = cockpit.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        const isBottomOffscreen = rect.bottom > viewportHeight - 40;
        const isTopOffscreen = rect.top < 0;

        if (isBottomOffscreen || isTopOffscreen) {
          cockpit.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }
      });
    });

    return () => {
      cancelAnimationFrame(rafId1);
      cancelAnimationFrame(rafId2);
    };
  }, [selectedId]);

  // R.17: Keyboard navigation for talent when cockpit is open
  useEffect(() => {
    if (!selectedId || filteredTalent.length === 0) return;

    const handleKeyDown = (event) => {
      const tag = event.target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        event.target.isContentEditable
      ) {
        return;
      }

      const isLeft = event.key === "ArrowLeft";
      const isRight = event.key === "ArrowRight";

      if (!isLeft && !isRight) return;

      event.preventDefault();

      const currentIndex = filteredTalent.findIndex((t) => t.id === selectedId);
      if (currentIndex === -1) return;

      let nextIndex;
      if (isLeft) {
        nextIndex = currentIndex === 0 ? filteredTalent.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex === filteredTalent.length - 1 ? 0 : currentIndex + 1;
      }

      const nextTalent = filteredTalent[nextIndex];
      if (nextTalent) {
        setSelectedId(nextTalent.id);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, filteredTalent]);

  // ══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  const handleCreateClick = useCallback(() => {
    setCreateModalOpen(true);
  }, []);

  // R.17: Toggle selection (click to select/deselect)
  const handleSelect = useCallback((talentId) => {
    setSelectedId((prev) => (prev === talentId ? null : talentId));
  }, []);

  // R.17: Close cockpit
  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
  }, []);

  // L.4: Open edit modal for the selected talent
  const handleEdit = useCallback((talentRecord) => {
    if (!canManage) {
      toast.error("You don't have permission to edit talent.");
      return;
    }
    setEditModalOpen(true);
  }, [canManage]);

  // L.4: Close edit modal
  const closeEditModal = useCallback(() => {
    setEditModalOpen(false);
  }, []);

  // L.4: Save talent from edit modal
  const handleSaveTalent = useCallback(async ({ updates, newImageFile, removeImage }) => {
    if (!canManage) {
      throw new Error("You do not have permission to edit talent.");
    }
    if (!selectedTalent?.id) {
      throw new Error("No talent selected for editing.");
    }

    const targetId = selectedTalent.id;
    const docRef = doc(db, ...currentTalentPath, targetId);
    setEditBusy(true);

    try {
      const patch = { ...updates };
      const previousGallery = Array.isArray(selectedTalent.galleryImages) ? selectedTalent.galleryImages : [];
      let removedGallery = [];

      // Process notes
      if (Object.prototype.hasOwnProperty.call(updates, "notes")) {
        const notesHtml = updates.notes || "";
        patch.notes = notesHtml;
        patch.sizing = stripHtml(notesHtml);
      }

      // Process measurements
      if (Object.prototype.hasOwnProperty.call(updates, "measurements")) {
        patch.measurements = normalizeMeasurementsMap(updates.measurements);
      }

      // Process gallery images
      if (Object.prototype.hasOwnProperty.call(updates, "galleryImages")) {
        const nextGallery = Array.isArray(updates.galleryImages) ? updates.galleryImages : [];
        const { finalGallery, removed } = await buildGalleryUpdate(targetId, nextGallery, previousGallery);
        patch.galleryImages = finalGallery;
        removedGallery = removed;
      }

      // Update Firestore
      await updateDoc(docRef, patch);

      // Handle headshot image update
      if (newImageFile) {
        const { path, downloadURL } = await uploadImageFile(newImageFile, {
          folder: "talent",
          id: targetId,
          filename: "headshot.jpg",
        });
        await updateDoc(docRef, { headshotPath: path, headshotUrl: downloadURL });
        // Delete old headshot if it existed and path changed
        if (selectedTalent.headshotPath && selectedTalent.headshotPath !== path) {
          deleteImageByPath(selectedTalent.headshotPath).catch(() => {});
        }
      } else if (removeImage && selectedTalent.headshotPath) {
        await updateDoc(docRef, { headshotPath: null, headshotUrl: null });
        deleteImageByPath(selectedTalent.headshotPath).catch(() => {});
      }

      // Clean up removed gallery images
      for (const removed of removedGallery) {
        if (removed.path) {
          deleteImageByPath(removed.path).catch(() => {});
        }
      }

      toast.success("Talent updated successfully");
      closeEditModal();
    } catch (err) {
      console.error("[LibraryTalentPage] Error saving talent:", err);
      throw new Error(err?.message || "Unable to update talent. Please try again.");
    } finally {
      setEditBusy(false);
    }
  }, [canManage, selectedTalent, currentTalentPath, closeEditModal]);

  const handleCreateTalent = useCallback(async () => {
    // The TalentCreateModal handles its own Firestore write internally
    // We just need to close the modal on success
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  // Loading state
  if (loading && talent.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Loading talent...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <span className="text-2xl">!</span>
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Unable to load talent
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {error}
          </p>
        </div>
      </div>
    );
  }

  // Empty state (no talent at all)
  if (!loading && talent.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
        <TalentHeaderBand
          canManage={canManage}
          onCreateClick={handleCreateClick}
          talentCount={0}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <TalentEmptyState
          canManage={canManage}
          onCreateClick={handleCreateClick}
        />
        {canManage && (
          <TalentCreateModal
            open={createModalOpen}
            busy={creating}
            onClose={() => setCreateModalOpen(false)}
            onCreate={handleCreateTalent}
          />
        )}
      </div>
    );
  }

  // R.17: Main workspace layout — Grid + Expand-Down Cockpit
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header band with search */}
      <TalentHeaderBand
        canManage={canManage}
        onCreateClick={handleCreateClick}
        talentCount={talent.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main content */}
      <div className="flex-1 px-6 py-6">
        {filteredTalent.length > 0 ? (
          <>
            {/* Talent grid — portrait-oriented tiles */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1">
              {filteredTalent.map((person) => (
                <TalentTile
                  key={person.id}
                  talent={person}
                  isSelected={selectedId === person.id}
                  onClick={() => handleSelect(person.id)}
                  tileRef={setTileRef(person.id)}
                />
              ))}
            </div>

            {/* Cockpit panel — only when talent selected */}
            {selectedTalent && (
              <div ref={cockpitRef}>
                <TalentCockpit
                  talent={selectedTalent}
                  canManage={canManage}
                  onEdit={handleEdit}
                  onClose={handleCloseDetail}
                />
              </div>
            )}
          </>
        ) : (
          <NoResultsState searchQuery={searchQuery} />
        )}
      </div>

      {/* Create modal */}
      {canManage && (
        <TalentCreateModal
          open={createModalOpen}
          busy={creating}
          onClose={() => setCreateModalOpen(false)}
          onCreate={handleCreateTalent}
        />
      )}

      {/* L.4: Edit modal */}
      {canManage && selectedTalent && (
        <TalentEditModal
          open={editModalOpen}
          talent={selectedTalent}
          busy={editBusy}
          onClose={closeEditModal}
          onSave={handleSaveTalent}
        />
      )}
    </div>
  );
}
