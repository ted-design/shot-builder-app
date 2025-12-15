import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "../lib/demoSafeFirestore";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/ui/PageHeader";
import ExpandableSearch from "../components/overview/ExpandableSearch";
import ExportButton from "../components/common/ExportButton";
import ViewModeMenu from "../components/overview/ViewModeMenu";
import FieldSettingsMenu from "../components/overview/FieldSettingsMenu";
import { searchTalent } from "../lib/search";
import BatchImageUploadModal from "../components/common/BatchImageUploadModal";
import TalentCreateModal from "../components/talent/TalentCreateModal";
import TalentEditModal from "../components/talent/TalentEditModal";
import TalentDetailModal from "../components/talent/TalentDetailModal";
import Thumb from "../components/Thumb";
import { useAuth } from "../context/AuthContext";
import { db, deleteImageByPath, uploadImageFile } from "../lib/firebase";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { writeDoc } from "../lib/firestoreWrites";
import { toast, showConfirm } from "../lib/toast";
import { talentPath } from "../lib/paths";
import { ROLE, canManageTalent } from "../lib/rbac";
import { normalizeMeasurementsMap } from "../lib/measurements";
import { LayoutGrid, Table, User, Upload } from "lucide-react";
import { readStorage, writeStorage } from "../lib/safeStorage";
import { nanoid } from "nanoid";

function buildDisplayName(firstName, lastName) {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || "Unnamed talent";
}

function formatContact(info = {}) {
  return [info.phone, info.email].filter(Boolean).join(" • ");
}

const stripHtml = (value) => {
  if (!value || typeof value !== "string") return "";
  const withNewlines = value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n");
  const withoutTags = withNewlines.replace(/<[^>]+>/g, " ");
  return withoutTags.replace(/\s+/g, " ").trim();
};

const getNotesPreview = (talentRecord, maxLength = 140) => {
  const raw = talentRecord?.notes || talentRecord?.sizing || "";
  const plain = stripHtml(raw);
  if (!plain) return "";
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trim()}…`;
};

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

const VIEW_STORAGE_KEY = "talent:viewMode";
const FIELD_PREFS_STORAGE_KEY = "talent:fieldPrefs";
const DENSITY_STORAGE_KEY = "talent:density";

const VIEW_PRESETS = [
  { value: "galleryComfortable", label: "Gallery · Comfy", icon: LayoutGrid, view: "gallery", density: "comfortable" },
  { value: "tableCompact", label: "Table · Compact", icon: Table, view: "table", density: "compact" },
];

const DENSITY_CONFIG = {
  compact: {
    cardPadding: "p-2.5",
    gridGap: "gap-2",
    imageClass: "aspect-[4/5] h-40",
    tableRow: "py-1.5",
    tablePadding: "px-2.5",
    tableText: "text-xs",
  },
  comfortable: {
    cardPadding: "p-4",
    gridGap: "gap-4",
    imageClass: "aspect-[4/5]",
    tableRow: "py-3",
    tablePadding: "px-4",
    tableText: "text-sm",
  },
};

const TALENT_FIELD_OPTIONS = [
  { key: "preview", label: "Preview" },
  { key: "name", label: "Name" },
  { key: "agency", label: "Agency" },
  { key: "contact", label: "Contact" },
  { key: "gender", label: "Gender" },
  { key: "sizing", label: "Notes" },
  { key: "url", label: "Portfolio URL" },
];

const FIELD_KEYS = TALENT_FIELD_OPTIONS.map((f) => f.key);
const DEFAULT_FIELD_VISIBILITY = {
  preview: true,
  name: true,
  agency: true,
  contact: true,
  gender: true,
  sizing: true,
  url: true,
};

const normaliseView = (value) => (value === "table" ? "table" : "gallery");
const normaliseDensity = (value) => (value === "compact" ? "compact" : "comfortable");
const normaliseOrder = (order) => {
  if (!Array.isArray(order)) return FIELD_KEYS;
  const base = order.filter((k) => FIELD_KEYS.includes(k));
  return [...base, ...FIELD_KEYS.filter((k) => !base.includes(k))];
};

const readFieldPrefs = () => {
  const visibility = { ...DEFAULT_FIELD_VISIBILITY };
  let order = [...FIELD_KEYS];
  let locked = [];
  try {
    const raw = readStorage(FIELD_PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.visibility) {
        FIELD_KEYS.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(parsed.visibility, key)) {
            visibility[key] = Boolean(parsed.visibility[key]);
          }
        });
      }
      if (parsed?.order) order = normaliseOrder(parsed.order);
      if (Array.isArray(parsed?.locked)) locked = parsed.locked.filter((k) => FIELD_KEYS.includes(k));
    }
  } catch {}
  return { visibility, order, locked };
};

function TalentCard({ talent, canManage, onView, editDisabled, visibility, densityKey }) {
  const displayName = talent.name || buildDisplayName(talent.firstName, talent.lastName);
  const contactLine = formatContact(talent);
  const notesPreview = getNotesPreview(talent);
  const showPreview = visibility?.preview !== false;
  const showName = visibility?.name !== false;
  const showAgency = visibility?.agency !== false;
  const showContact = visibility?.contact !== false;
  const showGender = visibility?.gender !== false;
  const showNotes = visibility?.sizing !== false;
  const showUrl = visibility?.url !== false;
  const densityConfig = DENSITY_CONFIG[densityKey] || DENSITY_CONFIG.comfortable;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {showPreview && (
        <Thumb
          path={talent.headshotPath || null}
          size={480}
          alt={displayName}
          className={`${densityConfig.imageClass || "aspect-[3/4]"} w-full overflow-hidden bg-slate-100 dark:bg-slate-900`}
          imageClassName="h-full w-full object-contain"
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">No image</div>
          }
        />
      )}
      <CardContent className={`flex flex-1 flex-col gap-3 ${densityConfig.cardPadding || ""}`}>
        <div className="space-y-1">
          {showName && (
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100" title={displayName}>
              <span className="block truncate">{displayName}</span>
            </div>
          )}
          {showAgency && talent.agency && (
            <div className="text-sm text-slate-600 dark:text-slate-400" title={talent.agency}>
              <span className="block truncate">{talent.agency}</span>
            </div>
          )}
          {showContact && contactLine && (
            <div className="text-sm text-slate-600 dark:text-slate-400" title={contactLine}>
              <span className="block truncate">{contactLine}</span>
            </div>
          )}
          {showGender && talent.gender && (
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <User className="h-4 w-4" aria-hidden="true" />
              <span>{talent.gender}</span>
            </div>
          )}
          {showNotes && notesPreview && (
            <div className="text-xs text-slate-500 dark:text-slate-400" title={notesPreview}>
              <span className="block truncate">{notesPreview}</span>
            </div>
          )}
          {showUrl && talent.url && (
            <a
              href={talent.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
              title={talent.url}
            >
              <span className="block truncate">{talent.url}</span>
            </a>
          )}
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onView?.(talent)} disabled={editDisabled}>
            View
          </Button>
          {!canManage && <div className="text-xs text-slate-500 dark:text-slate-400">Read only</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateTalentCard({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-card border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-6 text-center transition hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:border-slate-200 dark:disabled:border-slate-700 disabled:bg-slate-50 dark:disabled:bg-slate-900"
      aria-label="Create talent"
    >
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-3xl font-semibold text-primary">
        +
      </span>
      <span className="text-base font-semibold text-slate-900 dark:text-slate-100">Create talent</span>
      <span className="mt-1 max-w-[220px] text-sm text-slate-500 dark:text-slate-400">
        Keep track of models, contact details, and wardrobe notes.
      </span>
    </button>
  );
}

function TalentRowMenu({ talent, open, onClose, onView }) {
  if (!open) return null;

  return (
    <div
      role="menu"
      aria-label={`Actions for ${talent.name || buildDisplayName(talent.firstName, talent.lastName)}`}
      className="absolute left-0 top-8 z-10 w-40 rounded-md border border-slate-200 bg-white/95 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/95"
      onClick={(event) => event.stopPropagation()}
    >
      {typeof onView === "function" && (
        <button
          type="button"
          role="menuitem"
          className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
          onClick={() => {
            onView(talent);
            onClose();
          }}
        >
          View details
        </button>
      )}
    </div>
  );
}

export default function TalentPage() {
  const [talent, setTalent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [batchUploadModalOpen, setBatchUploadModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [rowMenuId, setRowMenuId] = useState(null);
  const [, setPendingDeleteId] = useState(null);
  const [viewMode, setViewMode] = useState(() => normaliseView(readStorage(VIEW_STORAGE_KEY)));
  const [density, setDensity] = useState(() => normaliseDensity(readStorage(DENSITY_STORAGE_KEY)));
  const initialFieldPrefs = useMemo(() => readFieldPrefs(), []);
  const [fieldVisibility, setFieldVisibility] = useState(initialFieldPrefs.visibility);
  const [fieldOrder, setFieldOrder] = useState(initialFieldPrefs.order);
  const [lockedFields, setLockedFields] = useState(initialFieldPrefs.locked);
  const rowMenuRef = useRef(null);

  const { clientId, role: globalRole, user, claims } = useAuth();
  const role = globalRole || ROLE.VIEWER;
  const canManage = canManageTalent(role);
  const currentTalentPath = useMemo(() => talentPath(clientId), [clientId]);

  const buildAuthDebugInfo = useCallback(
    () => ({
      uid: user?.uid ?? null,
      claims: {
        role: claims?.role ?? null,
        clientId: claims?.clientId ?? null,
        orgId: claims?.orgId ?? null,
      },
    }),
    [user, claims]
  );

  useEffect(() => {
    setLoading(true);
    const qy = query(collection(db, ...currentTalentPath), orderBy("lastName", "asc"));
    const unsubscribe = onSnapshot(
      qy,
      (snapshot) => {
        setTalent(snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() })));
        setLoading(false);
      },
      (error) => {
        setFeedback({ type: "error", text: error?.message || "Unable to load talent." });
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentTalentPath]);

  const filteredTalent = useMemo(() => {
    const term = queryText.trim();
    if (!term) return talent;

    const searchResults = searchTalent(talent, term);
    return searchResults.map((result) => result.item);
  }, [talent, queryText]);

  useEffect(() => {
    if (!editTarget) return;
    const latest = talent.find((entry) => entry.id === editTarget.id);
    if (latest && latest !== editTarget) {
      setEditTarget(latest);
    }
  }, [talent, editTarget]);

  useEffect(() => {
    if (!detailTarget) return;
    const latest = talent.find((entry) => entry.id === detailTarget.id);
    if (!latest) {
      setDetailTarget(null);
      return;
    }
    if (latest !== detailTarget) {
      setDetailTarget(latest);
    }
  }, [talent, detailTarget]);

  useEffect(() => {
    writeStorage(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    writeStorage(DENSITY_STORAGE_KEY, density);
  }, [density]);

  useEffect(() => {
    try {
      writeStorage(
        FIELD_PREFS_STORAGE_KEY,
        JSON.stringify({ visibility: fieldVisibility, order: fieldOrder, locked: lockedFields })
      );
    } catch {}
  }, [fieldVisibility, fieldOrder, lockedFields]);

  useEffect(() => {
    if (!rowMenuId) return undefined;
    const handleWindowClick = (event) => {
      if (rowMenuRef.current && !rowMenuRef.current.contains(event.target)) {
        setRowMenuId(null);
      }
    };
    window.addEventListener("mousedown", handleWindowClick);
    return () => window.removeEventListener("mousedown", handleWindowClick);
  }, [rowMenuId]);

  const resolvedVisibility = useMemo(
    () => ({ ...DEFAULT_FIELD_VISIBILITY, ...(fieldVisibility || {}) }),
    [fieldVisibility]
  );
  const resolvedOrder = useMemo(() => normaliseOrder(fieldOrder), [fieldOrder]);
  const resolvedDensity = DENSITY_CONFIG[density] ? density : "comfortable";
  const densityConfig = DENSITY_CONFIG[resolvedDensity] || DENSITY_CONFIG.comfortable;
  const currentViewPreset = useMemo(() => {
    const match = VIEW_PRESETS.find(
      (preset) => normaliseView(preset.view) === viewMode && normaliseDensity(preset.density) === resolvedDensity
    );
    return match ? match.value : VIEW_PRESETS[0].value;
  }, [viewMode, resolvedDensity]);

  const toggleFieldVisibility = useCallback(
    (key) => {
      if (lockedFields.includes(key)) return;
      setFieldVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [lockedFields]
  );

  const toggleFieldLock = useCallback((key) => {
    setLockedFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const handleFieldOrderChange = useCallback((next) => {
    setFieldOrder(normaliseOrder(next));
  }, []);

  const handleViewPresetChange = useCallback((presetValue) => {
    const preset = VIEW_PRESETS.find((item) => item.value === presetValue) || VIEW_PRESETS[0];
    setViewMode(normaliseView(preset.view));
    setDensity(normaliseDensity(preset.density));
  }, []);

  useEffect(() => {
    const mode = normaliseView(viewMode);
    if (mode === "table" && resolvedDensity !== "compact") {
      setDensity("compact");
    } else if (mode === "gallery" && resolvedDensity === "compact") {
      setDensity("comfortable");
    }
  }, [viewMode, resolvedDensity]);

  const notifySuccess = (message) => {
    toast.success(message);
  };

  const handleCreateTalent = async ({
    firstName,
    lastName,
    agency,
    phone,
    email,
    notes,
    measurements,
    sizing,
    galleryImages,
    url,
    gender,
    headshotFile,
  }) => {
    const pathSegments = currentTalentPath;
    const targetPath = `/${pathSegments.join("/")}`;

    if (!user) {
      const authInfo = buildAuthDebugInfo();
      console.warn("[Talent] Create blocked: no authenticated user", {
        path: targetPath,
        ...authInfo,
      });
      throw new Error("You must be signed in to add talent.");
    }

    if (!canManage) {
      const authInfo = buildAuthDebugInfo();
      console.warn("[Talent] Create blocked: role lacks manage permission", {
        path: targetPath,
        ...authInfo,
      });
      throw new Error("You do not have permission to add talent.");
    }

    const authInfo = buildAuthDebugInfo();
    const first = (firstName || "").trim();
    const last = (lastName || "").trim();
    if (!first && !last) {
      throw new Error("Enter at least a first or last name.");
    }

    setCreating(true);
    const name = buildDisplayName(first, last);

    console.info("[Talent] Attempting to create talent", {
      path: targetPath,
      ...authInfo,
    });

    try {
      const notesHtml = notes || sizing || "";
      const notesPlain = stripHtml(notesHtml || "");
      const measurementData = normalizeMeasurementsMap(measurements);
      const docRef = await writeDoc("create talent", () =>
        addDoc(collection(db, ...currentTalentPath), {
          firstName: first,
          lastName: last,
          agency: agency || "",
          phone: phone || "",
          email: email || "",
          notes: notesHtml || "",
          sizing: notesPlain,
          url: url || "",
          gender: gender || "",
          name,
          shotIds: [],
          headshotPath: null,
          galleryImages: [],
          measurements: measurementData,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null,
        })
      );

      console.info("[Talent] Talent created", {
        path: targetPath,
        docId: docRef.id,
        ...authInfo,
      });

      let headshotError = null;
      if (headshotFile) {
        try {
          const { path } = await uploadImageFile(headshotFile, { folder: "talent", id: docRef.id });
          await updateDoc(docRef, { headshotPath: path });
        } catch (error) {
          headshotError = error;
        }
      }

      let galleryError = null;
      if (Array.isArray(galleryImages) && galleryImages.length) {
        try {
          const { finalGallery } = await buildGalleryUpdate(docRef.id, galleryImages, []);
          await updateDoc(docRef, { galleryImages: finalGallery });
        } catch (error) {
          galleryError = error;
          console.error("[Talent] Gallery upload failed", {
            path: targetPath,
            docId: docRef.id,
            ...authInfo,
            error,
          });
        }
      }

      if (headshotError || galleryError) {
        const headshotMessage = headshotError
          ? describeFirebaseError(headshotError, "Headshot upload failed.")
          : null;
        const galleryMessage = galleryError
          ? describeFirebaseError(galleryError, "Gallery upload failed.")
          : null;
        const parts = [];
        if (headshotMessage) parts.push(`headshot upload (${headshotMessage.code}: ${headshotMessage.message})`);
        if (galleryMessage) parts.push(`gallery upload (${galleryMessage.code}: ${galleryMessage.message})`);
        const combined = parts.join(" and ");
        const text = `${name} was added, but the ${combined}. Try again from the edit dialog.`;
        setFeedback({ type: "error", text });
        if (headshotMessage) {
          toast.error({ title: "Headshot upload failed", description: `${headshotMessage.code}: ${headshotMessage.message}` });
        }
        if (galleryMessage) {
          toast.error({ title: "Gallery upload failed", description: `${galleryMessage.code}: ${galleryMessage.message}` });
        }
      } else {
        setFeedback({ type: "success", text: `${name} was added to talent.` });
        notifySuccess(`${name} was added to talent.`);
      }
    } catch (error) {
      const { code, message } = describeFirebaseError(
        error,
        "Unable to create talent. Check your connection and try again."
      );
      console.error("[Talent] Failed to create talent", {
        path: targetPath,
        ...authInfo,
        code,
        message,
        error,
      });
      toast.error({
        title: "Failed to create talent",
        description: `${code}: ${message} (${targetPath})`,
      });
      throw new Error(`${message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (talentRecord, options = {}) => {
    if (!canManage) {
      setFeedback({ type: "error", text: "You do not have permission to delete talent." });
      return;
    }
    const displayName = talentRecord.name || buildDisplayName(talentRecord.firstName, talentRecord.lastName);
    if (!options?.skipPrompt) {
      const confirmed = await showConfirm(`Delete ${displayName}? This action cannot be undone.`);
      if (!confirmed) return;
    }

    setPendingDeleteId(talentRecord.id);
    try {
      await deleteDoc(doc(db, ...currentTalentPath, talentRecord.id));
      if (talentRecord.headshotPath) {
        try {
          await deleteImageByPath(talentRecord.headshotPath);
        } catch (error) {
          setFeedback({
            type: "error",
            text: `${displayName} was removed, but the headshot cleanup failed: ${error?.message || error}`,
          });
          setPendingDeleteId(null);
          if (editTarget?.id === talentRecord.id) setEditTarget(null);
          return;
        }
      }
      const galleryImages = Array.isArray(talentRecord.galleryImages) ? talentRecord.galleryImages : [];
      if (galleryImages.length) {
        try {
          await Promise.all(
            galleryImages.map((image) => (image.path ? deleteImageByPath(image.path) : Promise.resolve()))
          );
        } catch (error) {
          setFeedback({
            type: "error",
            text: `${displayName} was removed, but gallery cleanup failed: ${error?.message || error}`,
          });
          setPendingDeleteId(null);
          if (editTarget?.id === talentRecord.id) setEditTarget(null);
          return;
        }
      }
      setFeedback({ type: "success", text: `${displayName} was deleted.` });
      if (editTarget?.id === talentRecord.id) setEditTarget(null);
    } catch (error) {
      setFeedback({ type: "error", text: error?.message || "Unable to delete talent." });
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleSaveTalent = async ({ updates, newImageFile, removeImage }) => {
    if (!canManage) {
      throw new Error("You do not have permission to edit talent.");
    }
    if (!editTarget?.id) {
      throw new Error("No talent selected for editing.");
    }

    const targetId = editTarget.id;
    const docRef = doc(db, ...currentTalentPath, targetId);
    setEditBusy(true);
    try {
      const patch = { ...updates };
      const previousGallery = Array.isArray(editTarget.galleryImages) ? editTarget.galleryImages : [];
      let removedGallery = [];
      if (Object.prototype.hasOwnProperty.call(updates, "notes")) {
        const notesHtml = updates.notes || "";
        patch.notes = notesHtml;
        patch.sizing = stripHtml(notesHtml);
      }
      if (Object.prototype.hasOwnProperty.call(updates, "measurements")) {
        patch.measurements = normalizeMeasurementsMap(updates.measurements);
      }
      if (Object.prototype.hasOwnProperty.call(updates, "galleryImages")) {
        const nextGallery = Array.isArray(updates.galleryImages) ? updates.galleryImages : [];
        const { finalGallery, removed } = await buildGalleryUpdate(targetId, nextGallery, previousGallery);
        patch.galleryImages = finalGallery;
        removedGallery = removed;
      }

      await updateDoc(docRef, patch);

      if (newImageFile) {
        const { path } = await uploadImageFile(newImageFile, { folder: "talent", id: targetId });
        await updateDoc(docRef, { headshotPath: path });
        if (editTarget.headshotPath) {
          try {
            await deleteImageByPath(editTarget.headshotPath);
          } catch {
            // Ignore cleanup failure; stale file can be removed later.
          }
        }
      } else if (removeImage && editTarget.headshotPath) {
        await updateDoc(docRef, { headshotPath: null });
        try {
          await deleteImageByPath(editTarget.headshotPath);
        } catch {
          // Ignore cleanup failure; stale file can be removed later.
        }
      }

      if (removedGallery.length) {
        await Promise.all(
          removedGallery.map((item) => (item.path ? deleteImageByPath(item.path) : Promise.resolve()))
        );
      }

      const name = updates.name || buildDisplayName(updates.firstName, updates.lastName);
      setFeedback({ type: "success", text: `Saved changes for ${name}.` });
    } catch (error) {
      setFeedback({ type: "error", text: error?.message || "Unable to update talent." });
      throw error;
    } finally {
      setEditBusy(false);
    }
  };

  const closeEditModal = () => setEditTarget(null);

  const renderTableView = () => {
    if (!filteredTalent.length) {
      return (
        <Card className="mx-6">
          <CardContent className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No talent match the current filters.
          </CardContent>
        </Card>
      );
    }

    const showRowMenu = canManage;
    const columns = resolvedOrder
      .map((key) => {
        switch (key) {
          case "preview":
            return { key, label: "Preview" };
          case "name":
            return { key, label: "Name" };
          case "agency":
            return { key, label: "Agency" };
          case "contact":
            return { key, label: "Contact" };
          case "gender":
            return { key, label: "Gender" };
          case "sizing":
            return { key, label: "Notes" };
          case "url":
            return { key, label: "Portfolio" };
          default:
            return null;
        }
      })
      .filter(Boolean)
      .filter((col) => resolvedVisibility[col.key] !== false);

    return (
      <Card className="mx-6">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  {showRowMenu && <th className={`${densityConfig.tablePadding} ${densityConfig.tableRow} w-10`} aria-label="Row actions" />}
                  {columns.map((col) => (
                    <th key={col.key} className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                {filteredTalent.map((entry) => {
                  const contactLine = formatContact(entry);
                  const displayName = entry.name || buildDisplayName(entry.firstName, entry.lastName);
                  const notesPreview = getNotesPreview(entry);
                  return (
                    <tr
                      key={entry.id}
                      onClick={() => {
                        setRowMenuId(null);
                        setDetailTarget(entry);
                      }}
                      className="odd:bg-white even:bg-slate-50/40 hover:bg-slate-100 dark:odd:bg-slate-900 dark:even:bg-slate-800/40 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {showRowMenu && (
                        <td
                          className={`${densityConfig.tablePadding} ${densityConfig.tableRow} w-10 align-top`}
                          ref={rowMenuId === entry.id ? rowMenuRef : null}
                        >
                          <div className="relative">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                              onClick={(event) => {
                                event.stopPropagation();
                                setRowMenuId((current) => (current === entry.id ? null : entry.id));
                              }}
                              aria-label={`Open actions for ${displayName}`}
                            >
                              ···
                            </Button>
                            <TalentRowMenu
                              talent={entry}
                              open={rowMenuId === entry.id}
                              onClose={() => setRowMenuId(null)}
                              onView={setDetailTarget}
                            />
                          </div>
                        </td>
                      )}
                      {columns.map((col) => {
                        if (col.key === "preview") {
                          return (
                            <td key="preview" className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                              <Thumb
                                path={entry.headshotPath || null}
                                size={240}
                                alt={displayName}
                                className="h-16 w-12 overflow-hidden rounded bg-slate-100 dark:bg-slate-800"
                                imageClassName="h-full w-full object-contain"
                                fallback={
                                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                                    No image
                                  </div>
                                }
                              />
                            </td>
                          );
                        }
                        if (col.key === "name") {
                          return (
                            <td key="name" className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                              <div className={`${densityConfig.tableText} font-semibold text-slate-900 dark:text-slate-100`}>
                                {displayName}
                              </div>
                            </td>
                          );
                        }
                        if (col.key === "agency") {
                          return (
                            <td key="agency" className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                              <div className={`${densityConfig.tableText} text-slate-600 dark:text-slate-400`}>{entry.agency || "—"}</div>
                            </td>
                          );
                        }
                        if (col.key === "contact") {
                          return (
                            <td key="contact" className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                              <div className={`${densityConfig.tableText} text-slate-600 dark:text-slate-400`}>{contactLine || "—"}</div>
                            </td>
                          );
                        }
                        if (col.key === "gender") {
                          return (
                            <td key="gender" className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                              <div className={`${densityConfig.tableText} text-slate-600 dark:text-slate-400`}>{entry.gender || "—"}</div>
                            </td>
                          );
                        }
                        if (col.key === "sizing") {
                          return (
                            <td key="sizing" className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                              <div className={`${densityConfig.tableText} text-slate-600 dark:text-slate-400`}>{notesPreview || "—"}</div>
                            </td>
                          );
                        }
                        if (col.key === "url") {
                          return (
                            <td key="url" className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                              {entry.url ? (
                                <a href={entry.url} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
                                  {entry.url}
                                </a>
                              ) : (
                                <span className={`${densityConfig.tableText} text-slate-500 dark:text-slate-400`}>—</span>
                              )}
                            </td>
                          );
                        }
                        return null;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader sticky={true} className="top-14 z-40">
        <PageHeader.Content>
          <div>
            <PageHeader.Title>Talent</PageHeader.Title>
            <PageHeader.Description>
              Track models, their agencies, and wardrobe notes.
            </PageHeader.Description>
          </div>
          <PageHeader.Actions>
            <div className="flex flex-wrap items-center gap-3">
              <ExpandableSearch
                value={queryText}
                onChange={setQueryText}
                placeholder="Search talent by name, agency, or contact..."
                ariaLabel="Search talent"
              />
              <ViewModeMenu
                options={VIEW_PRESETS}
                value={currentViewPreset}
                onChange={handleViewPresetChange}
                ariaLabel="Select view preset"
              />
              <FieldSettingsMenu
                fields={TALENT_FIELD_OPTIONS}
                visibleMap={resolvedVisibility}
                lockedKeys={lockedFields}
                order={resolvedOrder}
                onToggleVisible={toggleFieldVisibility}
                onToggleLock={toggleFieldLock}
                onReorder={handleFieldOrderChange}
              />
              <ExportButton data={filteredTalent} entityType="talent" />
              {canManage && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setBatchUploadModalOpen(true)}
                    className="flex-none whitespace-nowrap flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Batch Upload
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setCreateModalOpen(true)}
                    className="flex-none whitespace-nowrap"
                  >
                    New talent
                  </Button>
                </>
              )}
            </div>
          </PageHeader.Actions>
        </PageHeader.Content>
      </PageHeader>

      {feedback && (
        <div
          className={`mx-6 rounded-md px-4 py-2 text-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {!canManage && (
        <div className="mx-6 rounded-card border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm text-neutral-600 dark:text-neutral-400">
          Talent records are read-only for your role. Producers can add or edit talent details.
        </div>
      )}

      {viewMode === "table" ? (
        renderTableView()
      ) : (
        <div
          className={`mx-6 grid ${
            resolvedDensity === "compact"
              ? `${densityConfig.gridGap} sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6`
              : `${densityConfig.gridGap} sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6`
          }`}
        >
          {canManage && (
            <CreateTalentCard onClick={() => setCreateModalOpen(true)} disabled={creating} />
          )}
          {filteredTalent.map((entry) => (
            <TalentCard
              key={entry.id}
              talent={entry}
              canManage={canManage}
              onView={setDetailTarget}
              editDisabled={editBusy && editTarget?.id === entry.id}
              visibility={resolvedVisibility}
              densityKey={resolvedDensity}
            />
          ))}
          {!loading && !filteredTalent.length && (
            <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-5">
              <CardContent className="p-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
                No talent matches the current filters.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {canManage && (
        <TalentCreateModal
          open={createModalOpen}
          busy={creating}
          onClose={() => setCreateModalOpen(false)}
          onCreate={handleCreateTalent}
        />
      )}

      {detailTarget && (
        <TalentDetailModal
          open={!!detailTarget}
          talent={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={(talentRecord) => {
            setEditTarget(talentRecord);
            setDetailTarget(null);
          }}
          canEdit={canManage}
          clientId={clientId}
        />
      )}

      {editTarget && (
        <TalentEditModal
          open={!!editTarget}
          talent={editTarget}
          busy={editBusy}
          onClose={closeEditModal}
          onSave={handleSaveTalent}
          onDelete={handleDelete}
        />
      )}

      {canManage && (
        <BatchImageUploadModal
          open={batchUploadModalOpen}
          onClose={() => setBatchUploadModalOpen(false)}
          folder="talent"
          entityId="batch-demo"
          entityName="Talent Headshots (Demo)"
          maxFiles={10}
          onFileUploaded={(upload) => {
            toast.success(`Uploaded ${upload.filename}`);
          }}
          onUploadComplete={(successfulUploads) => {
            toast.success(`Successfully uploaded ${successfulUploads.length} file${successfulUploads.length === 1 ? "" : "s"}!`);
          }}
        />
      )}
    </div>
  );
}
