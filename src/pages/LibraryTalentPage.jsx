/**
 * LibraryTalentPage — Canonical Full-Page Workspace Shell
 *
 * DESIGN PHILOSOPHY (L.2 Delta)
 * =============================
 * This page transforms the Library → Talent view into a workspace-style experience
 * following the Products V3 / Shot Editor V3 / Library Locations spatial language:
 *
 * LAYOUT:
 * - TOP: Header band with page title, search, and primary actions
 * - LEFT: Scannable talent rail with search results
 * - RIGHT: Selected talent detail canvas
 *
 * KEY CHANGES FROM LEGACY:
 * 1. Master-detail pattern replaces modal-first UX
 * 2. Talent selection is local state (no URL routing per spec)
 * 3. Designed empty states for both rail and canvas
 * 4. Full-page workspace instead of admin table/gallery presentation
 *
 * DATA SOURCE:
 * - Firestore: clients/{clientId}/talent (via talentPath)
 * - Real-time subscription via onSnapshot
 */

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Building2,
  ExternalLink,
  Ruler,
  Pencil,
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
  const finalGallery = [];

  for (let index = 0; index < sortedNext.length; index += 1) {
    const attachment = sortedNext[index];
    const description = (attachment.description || "").trim();
    const cropData = attachment.cropData || null;
    const id = attachment.id || nanoid();

    if (attachment.file) {
      const baseName = attachment.file.name || `image-${id}.jpg`;
      const safeName = baseName.replace(/\s+/g, "_");
      const { path, downloadURL } = await uploadImageFile(attachment.file, {
        folder: "talent",
        id: talentId,
        filename: `${id}-${safeName}`,
      });
      finalGallery.push({ id, path, downloadURL, description, cropData, order: index });
      continue;
    }

    const previous = previousMap.get(attachment.id) || {};
    const path = attachment.path || previous.path || null;
    const downloadURL = attachment.downloadURL || previous.downloadURL || path || null;
    if (!path && !downloadURL) continue;

    finalGallery.push({
      id,
      path,
      downloadURL,
      description,
      cropData: cropData ?? previous.cropData ?? null,
      order: index,
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
// TALENT RAIL ITEM
// ============================================================================

function TalentRailItem({ talent, isSelected, onClick }) {
  const name = buildDisplayName(talent);
  const agency = (talent.agency || "").trim();

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
        {/* Thumbnail — L.4: Rounded rectangle to avoid cropping heads */}
        <div className="flex-shrink-0 w-10 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700">
          <Thumb
            path={talent.headshotPath || null}
            size={96}
            alt={name}
            className="w-full h-full"
            imageClassName="w-full h-full object-cover object-top"
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-5 h-5 text-slate-300 dark:text-slate-500" />
              </div>
            }
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${
            isSelected
              ? "text-slate-900 dark:text-slate-100"
              : "text-slate-700 dark:text-slate-300"
          }`}>
            {name}
          </p>
          {agency && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {agency}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// TALENT RAIL (LEFT PANEL)
// ============================================================================

function TalentRail({
  talent,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  loading,
}) {
  return (
    <aside className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col overflow-hidden">
      {/* Search header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
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

      {/* Talent list */}
      <div className="flex-1 overflow-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : talent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
              <User className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              {searchQuery ? "No matches found" : "No talent yet"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              {searchQuery
                ? "Try a different search term"
                : "Create talent to get started"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {talent.map((person) => (
              <TalentRailItem
                key={person.id}
                talent={person}
                isSelected={selectedId === person.id}
                onClick={() => onSelect(person.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Count footer */}
      {!loading && talent.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {talent.length} {talent.length === 1 ? "talent" : "talent"}
          </p>
        </div>
      )}
    </aside>
  );
}

// ============================================================================
// TALENT DETAIL CANVAS (RIGHT PANEL)
// ============================================================================

function TalentDetailCanvas({ talent, canManage, onEdit }) {
  if (!talent) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-800">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-slate-300 dark:text-slate-500" />
          </div>
          <h2 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
            Select a talent
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Choose a talent from the list to view their details, or create a new one.
          </p>
        </div>
      </div>
    );
  }

  const name = buildDisplayName(talent);
  const agency = (talent.agency || "").trim();
  const notesContent = talent.notes || talent.sizing || "";
  const notesPlain = stripHtml(notesContent);
  // L.4: Parse measurements into structured display entries
  const measurementEntries = parseMeasurementsForDisplay(talent.measurements);
  const hasMeasurements = measurementEntries.length > 0;

  return (
    <main className="flex-1 overflow-auto bg-white dark:bg-slate-800">
      <div className="max-w-2xl mx-auto px-8 py-8">
        {/* L.4: Hero image - rectangular with rounded corners for full-body/editorial imagery */}
        <div className="relative w-48 h-64 mx-auto rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-700 mb-6 shadow-sm">
          <Thumb
            path={talent.headshotPath || null}
            size={512}
            alt={name}
            className="w-full h-full"
            imageClassName="w-full h-full object-cover object-top"
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-16 h-16 text-slate-300 dark:text-slate-500" />
              </div>
            }
          />
        </div>

        {/* Name - centered under portrait */}
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2 text-center">
          {name}
        </h1>

        {/* Agency - centered */}
        {agency && (
          <p className="text-base text-slate-600 dark:text-slate-400 text-center mb-6">
            {agency}
          </p>
        )}

        {!agency && <div className="mb-6" />}

        {/* Details section */}
        <div className="space-y-4">
          {/* Gender */}
          {talent.gender && (
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Gender
                </p>
                <p className="text-base text-slate-900 dark:text-slate-100">
                  {talent.gender}
                </p>
              </div>
            </div>
          )}

          {/* Phone */}
          {talent.phone && (
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Phone
                </p>
                <p className="text-base text-slate-900 dark:text-slate-100">
                  {talent.phone}
                </p>
              </div>
            </div>
          )}

          {/* Email */}
          {talent.email && (
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Email
                </p>
                <a
                  href={`mailto:${talent.email}`}
                  className="text-base text-primary hover:underline"
                >
                  {talent.email}
                </a>
              </div>
            </div>
          )}

          {/* Portfolio URL */}
          {talent.url && (
            <div className="flex items-start gap-3">
              <ExternalLink className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Portfolio
                </p>
                <a
                  href={talent.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base text-primary hover:underline break-all"
                >
                  {talent.url}
                </a>
              </div>
            </div>
          )}

          {/* L.4: Measurements - structured 2-column spec grid */}
          {hasMeasurements && (
            <div className="flex items-start gap-3">
              <Ruler className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Measurements
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {measurementEntries.map(({ key, label, value }) => (
                    <div key={key} className="flex justify-between gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {label}
                      </span>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {notesPlain && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Notes
                </p>
                <p className="text-base text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {notesPlain}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Empty state for no details */}
        {!agency && !talent.phone && !talent.email && !talent.url && !talent.gender && !notesPlain && !hasMeasurements && (
          <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-6 text-center mt-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No additional details for this talent.
            </p>
            {canManage && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Edit the talent to add contact info, notes, or measurements.
              </p>
            )}
          </div>
        )}

        {/* Actions — L.4: Edit opens modal when canManage is true */}
        {canManage ? (
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
            <Button variant="secondary" onClick={() => onEdit(talent)} className="gap-1.5">
              <Pencil className="w-4 h-4" />
              Edit talent
            </Button>
          </div>
        ) : (
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Only producers and admins can edit talent records.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

// ============================================================================
// HEADER BAND
// ============================================================================

function TalentHeaderBand({ canManage, onCreateClick, talentCount }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Title + description */}
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Talent
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track models, their agencies, contact details, and wardrobe notes
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
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

  // Auto-select first talent when data loads and nothing is selected
  useEffect(() => {
    if (!loading && talent.length > 0 && !selectedId) {
      setSelectedId(talent[0].id);
    }
  }, [loading, talent, selectedId]);

  // Clear selection if selected talent was deleted
  useEffect(() => {
    if (selectedId && !talent.find((t) => t.id === selectedId)) {
      setSelectedId(talent.length > 0 ? talent[0].id : null);
    }
  }, [talent, selectedId]);

  // ══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  const handleCreateClick = useCallback(() => {
    setCreateModalOpen(true);
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
    console.info("[LibraryTalentPage] Create talent requested");
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

  // Main workspace layout
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header band */}
      <TalentHeaderBand
        canManage={canManage}
        onCreateClick={handleCreateClick}
        talentCount={talent.length}
      />

      {/* Workspace: Rail + Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left rail */}
        <TalentRail
          talent={filteredTalent}
          selectedId={selectedId}
          onSelect={setSelectedId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          loading={false}
        />

        {/* Right canvas */}
        <TalentDetailCanvas
          talent={selectedTalent}
          canManage={canManage}
          onEdit={handleEdit}
        />
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
