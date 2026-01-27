/**
 * ShotEditorHeaderBandV3 - Sticky header band for the shot editor workspace
 *
 * This is the "cockpit strip" providing shot identity, status, and actions.
 *
 * Props:
 * - shot: The shot document object (required)
 * - projectId: Current project ID for navigation (required)
 * - readOnly: Boolean for read-only mode (optional, default false)
 */

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { shotsPath } from "../../../lib/paths";
import { useAuth } from "../../../context/AuthContext";
import { logActivity, createShotUpdatedActivity } from "../../../lib/activityLogger";
import { toDateInputValue, parseDateToTimestamp } from "../../../lib/shotDraft";
import { shotStatusOptions, normaliseShotStatus } from "../../../lib/shotStatus";
import { stripHtml } from "../../../lib/stripHtml";
import { isCorruptShotDescription } from "../../../lib/shotDescription";
import { getShotNotesPreview } from "../../../lib/shotNotes";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { StatusBadge } from "../../ui/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  ArrowLeft,
  Copy,
  MoreHorizontal,
  ExternalLink,
  Sparkles,
  ChevronDown,
  Check,
  Pencil,
  Trash2,
  Calendar,
  Eraser,
} from "lucide-react";
import { toast } from "../../../lib/toast";
import { useDeleteShot } from "../../../hooks/useFirestoreMutations";
import ConfirmDialog from "../../common/ConfirmDialog";

export default function ShotEditorHeaderBandV3({ shot, projectId, readOnly = false }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const clientId = auth?.clientId;

  // ══════════════════════════════════════════════════════════════════════════
  // RETURN TO CONTEXT (J.6)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Parse returnTo query param and derive navigation target
   *
   * SUPPORTED FORMATS (per J.6 spec):
   * 1) returnTo=schedule → navigate to /projects/${projectId}/shots?view=planner
   * 2) returnTo=planner  → navigate to /projects/${projectId}/shots?view=planner (alias)
   * 3) returnTo=<encoded path starting with "/"> → decode and navigate (internal only)
   *
   * SECURITY: Only allow navigation to internal paths (must start with "/")
   */
  const returnToContext = useMemo(() => {
    const returnTo = searchParams.get("returnTo");
    if (!returnTo) return null;

    // Known aliases
    if (returnTo === "schedule" || returnTo === "planner") {
      return {
        label: "Return to Schedule",
        path: `/projects/${projectId}/shots?view=planner`,
      };
    }

    // Encoded path format (must start with "/")
    try {
      const decodedPath = decodeURIComponent(returnTo);
      // Security: only allow internal paths starting with "/"
      // Must not contain protocol or external URLs
      if (
        decodedPath.startsWith("/") &&
        !decodedPath.includes("://") &&
        !decodedPath.startsWith("//")
      ) {
        // Derive a simple label from the path
        const pathSegments = decodedPath.split("/").filter(Boolean);
        const lastSegment = pathSegments[pathSegments.length - 1] || "previous page";
        const label = `Return to ${lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1).replace(/[?#].*$/, "")}`;
        return {
          label,
          path: decodedPath,
        };
      }
    } catch {
      // Invalid encoded string - ignore silently
    }

    // Unrecognized format - do nothing
    return null;
  }, [searchParams, projectId]);

  // Delete shot mutation (uses soft delete - sets deleted: true)
  const deleteShotMutation = useDeleteShot(clientId, projectId, {
    shotName: shot?.name || "Untitled",
  });

  const [isApplying, setIsApplying] = useState(false);
  const [statusSaveState, setStatusSaveState] = useState("idle"); // idle | saving | saved

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Shot number editing state
  const [isEditingShotNumber, setIsEditingShotNumber] = useState(false);
  const [shotNumberDraft, setShotNumberDraft] = useState("");
  const [shotNumberSaveState, setShotNumberSaveState] = useState("idle"); // idle | saving | saved | error

  // Description editing state
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descriptionSaveState, setDescriptionSaveState] = useState("idle"); // idle | saving | saved | error
  const descriptionTextareaRef = useRef(null);

  // Date editing state
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState("");
  const [dateSaveState, setDateSaveState] = useState("idle"); // idle | saving | saved | error
  const dateInputRef = useRef(null);

  // Track timeout IDs for cleanup to prevent memory leaks
  const timeoutsRef = useRef(new Set());

  // Cleanup all timeouts on unmount to prevent state updates on unmounted component
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((id) => clearTimeout(id));
      timeouts.clear();
    };
  }, []);

  /**
   * Helper to set a timeout that auto-cleans from tracking set
   */
  const setSafeTimeout = useCallback((callback, delay) => {
    const id = setTimeout(() => {
      timeoutsRef.current.delete(id);
      callback();
    }, delay);
    timeoutsRef.current.add(id);
    return id;
  }, []);

  // Auto-focus description textarea and place cursor at end when entering edit mode
  useEffect(() => {
    if (isEditingDescription && descriptionTextareaRef.current) {
      const textarea = descriptionTextareaRef.current;
      textarea.focus();
      // Place cursor at end of text
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
    }
  }, [isEditingDescription]);

  // Auto-focus date input when entering edit mode
  useEffect(() => {
    if (isEditingDate && dateInputRef.current) {
      dateInputRef.current.focus();
    }
  }, [isEditingDate]);

  const notesPreview = useMemo(() => getShotNotesPreview(shot) || "", [shot?.notes]);
  const rawDescription = useMemo(
    () => (typeof shot?.description === "string" ? shot.description : ""),
    [shot?.description]
  );
  const isCorruptDescription = useMemo(
    () => isCorruptShotDescription(rawDescription, notesPreview),
    [rawDescription, notesPreview]
  );
  const descriptionDisplayText = useMemo(() => {
    if (isCorruptDescription) return "";
    return stripHtml(rawDescription).slice(0, 200).trim();
  }, [isCorruptDescription, rawDescription]);

  // ══════════════════════════════════════════════════════════════════════════
  // DERIVED VALUES
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Derive colorway label based on primary look hero, or fallback to shot.products
   *
   * DERIVATION RULES:
   * 1) If shot.looks exists and has at least one look:
   *    a) Choose "primary look" (smallest order value, fallback to first item)
   *    b) If primaryLook.heroProductId exists:
   *       - Find that product in primaryLook.products (match productId)
   *       - If found with non-empty colourName => use that
   *    c) If no hero:
   *       - If exactly 1 distinct non-empty colourName in primaryLook.products => use it
   *       - Else => "—" (encourage setting hero for accuracy)
   * 2) Else (no looks):
   *    - Use existing logic across shot.products:
   *      - 0 distinct => "—"
   *      - 1 distinct => that value
   *      - 2+ distinct => "Multiple"
   */
  const colorwayDerived = useMemo(() => {
    // Helper: get distinct non-empty colorways from a products array
    const getDistinctColorways = (products) => {
      if (!products?.length) return [];
      return [
        ...new Set(
          products
            .map((p) => p.colourName)
            .filter((name) => name && typeof name === "string" && name.trim() !== "")
        ),
      ];
    };

    // CASE 1: Looks exist - derive from primary look
    if (shot?.looks?.length > 0) {
      // Find primary look: smallest order value, fallback to first item
      const primaryLook = shot.looks.reduce((primary, look) => {
        if (primary === null) return look;
        // Prefer smallest order; if equal or undefined, keep first
        if (typeof look.order === "number" && typeof primary.order === "number") {
          return look.order < primary.order ? look : primary;
        }
        return primary;
      }, null);

      if (!primaryLook) {
        return { label: "—", needsHeroHint: false };
      }

      // Check for hero product
      if (primaryLook.heroProductId) {
        const heroProduct = primaryLook.products?.find(
          (p) => p.productId === primaryLook.heroProductId
        );
        if (heroProduct?.colourName && heroProduct.colourName.trim() !== "") {
          return { label: heroProduct.colourName, needsHeroHint: false };
        }
      }

      // No hero or hero not found - check for single distinct colorway
      const distinctColorways = getDistinctColorways(primaryLook.products);
      if (distinctColorways.length === 1) {
        return { label: distinctColorways[0], needsHeroHint: true };
      }

      // Multiple or no colorways - show "—" to encourage hero selection
      return { label: "—", needsHeroHint: true };
    }

    // CASE 2: No looks - use existing shot.products logic
    const distinctColorways = getDistinctColorways(shot?.products);
    if (distinctColorways.length === 0) {
      return { label: "—", needsHeroHint: false };
    }
    if (distinctColorways.length === 1) {
      return { label: distinctColorways[0], needsHeroHint: false };
    }
    // Multiple distinct colorways - keep existing "Multiple" behavior
    return { label: "Multiple", needsHeroHint: false };
  }, [shot?.looks, shot?.products]);

  const colorwayLabel = colorwayDerived.label;
  const colorwayNeedsHeroHint = colorwayDerived.needsHeroHint;

  /**
   * Derive suggested shot name from the primary look's hero product
   *
   * DERIVATION RULES:
   * 1) PRIMARY PATH: If shot.looks exists and primary look + heroProductId found:
   *    - Find that product in primaryLook.products (match productId)
   *    - suggestedName = heroProduct.productName
   * 2) FALLBACK PATH (only if looks/hero missing):
   *    - Collect distinct non-empty productName values from shot.products
   *    - If exactly 1 distinct value => suggestedName = that value
   *    - Else => null (no suggestion)
   *
   * NOTE: Color is NOT included in suggested name since it's already shown as a chip
   */
  const suggestedName = useMemo(() => {
    // Helper: get distinct non-empty productNames from a products array
    const getDistinctProductNames = (products) => {
      if (!products?.length) return [];
      return [
        ...new Set(
          products
            .map((p) => p.productName)
            .filter((name) => name && typeof name === "string" && name.trim() !== "")
            .map((name) => name.trim())
        ),
      ];
    };

    // PRIMARY PATH: Looks-based derivation
    if (shot?.looks?.length > 0) {
      // Find primary look: smallest order value, fallback to first item
      const primaryLook = shot.looks.reduce((primary, look) => {
        if (primary === null) return look;
        if (typeof look.order === "number" && typeof primary.order === "number") {
          return look.order < primary.order ? look : primary;
        }
        return primary;
      }, null);

      if (primaryLook?.heroProductId) {
        // Find hero product in primary look's products
        const heroProduct = primaryLook.products?.find(
          (p) => p.productId === primaryLook.heroProductId
        );

        // Use productName if available and non-empty
        if (heroProduct?.productName && heroProduct.productName.trim() !== "") {
          return heroProduct.productName.trim();
        }
      }
      // Looks exist but no hero found - don't fall back to shot.products
      return null;
    }

    // FALLBACK PATH: No looks - derive from shot.products if exactly 1 distinct productName
    const distinctProductNames = getDistinctProductNames(shot?.products);
    if (distinctProductNames.length === 1) {
      return distinctProductNames[0];
    }

    return null;
  }, [shot?.looks, shot?.products]);

  /**
   * Determine if suggestion should be shown:
   * - suggestedName exists AND
   * - shot.name is empty OR differs from suggestedName
   */
  const showSuggestion = useMemo(() => {
    if (!suggestedName) return false;
    const currentName = shot?.name?.trim() || "";
    return currentName === "" || currentName !== suggestedName;
  }, [suggestedName, shot?.name]);

  // Status display config - maps status values to StatusBadge variants
  const STATUS_VARIANT_MAP = {
    todo: "pending",
    in_progress: "info",
    complete: "complete",
    on_hold: "on-hold",
  };

  const currentStatus = normaliseShotStatus(shot?.status);
  const currentStatusOption = shotStatusOptions.find((opt) => opt.value === currentStatus) || shotStatusOptions[0];
  const statusVariant = STATUS_VARIANT_MAP[currentStatus] || "pending";

  // ══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  const handleBack = () => {
    navigate(`/projects/${projectId}/shots`);
  };

  /**
   * Handle "Return to" navigation (J.6)
   * Navigates to the path specified in returnToContext
   */
  const handleReturnTo = useCallback(() => {
    if (returnToContext?.path) {
      navigate(returnToContext.path);
    }
  }, [returnToContext, navigate]);

  const handleOpenLegacy = () => {
    // Navigate to the shots list (legacy uses modal-based editing)
    navigate(`/projects/${projectId}/shots`);
  };

  const handleDuplicate = () => {
    // TODO: Implement shot duplication - opens duplicate modal
  };

  /**
   * Open delete confirmation dialog
   */
  const handleOpenDeleteConfirm = () => {
    if (readOnly) return;
    setShowDeleteConfirm(true);
  };

  /**
   * Close delete confirmation dialog
   */
  const handleCloseDeleteConfirm = () => {
    setShowDeleteConfirm(false);
  };

  /**
   * Confirm deletion of the shot
   *
   * Uses soft delete (sets deleted: true) via useDeleteShot mutation.
   * On success, navigates back to the shots list.
   * No undo/recycle bin - deletion is final from user perspective.
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!shot?.id || !clientId || readOnly) return;

    setIsDeleting(true);

    try {
      await new Promise((resolve, reject) => {
        deleteShotMutation.mutate(
          { shotId: shot.id },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });

      toast.success(`"${shot.name || "Untitled"}" deleted`);
      setShowDeleteConfirm(false);

      // Navigate back to shots list
      navigate(`/projects/${projectId}/shots`);
    } catch (error) {
      console.error("[ShotEditorHeaderBandV3] Failed to delete shot:", error);
      toast.error("Failed to delete shot. Please try again.");
      setIsDeleting(false);
    }
  }, [shot?.id, shot?.name, clientId, projectId, readOnly, deleteShotMutation, navigate]);

  /**
   * Change shot status
   *
   * AUDIT PATTERN (per src/schemas/common.js:80-85):
   * - updatedBy: string (user UID only, not object triplet)
   * - updatedAt: serverTimestamp()
   *
   * Activity logging via createShotUpdatedActivity()
   */
  const handleStatusChange = useCallback(
    async (newStatus) => {
      // Guard: no-op if same status, missing data, or read-only
      if (newStatus === currentStatus || !clientId || !shot?.id || readOnly) {
        return;
      }

      setStatusSaveState("saving");

      try {
        const shotRef = doc(db, ...shotsPath(clientId), shot.id);
        const user = auth?.user;

        // Build update payload following schema audit pattern
        const updatePayload = {
          status: newStatus,
          updatedAt: serverTimestamp(),
        };

        // Only write updatedBy if user exists (never write null)
        if (user?.uid) {
          updatePayload.updatedBy = user.uid;
        }

        await updateDoc(shotRef, updatePayload);

        // Log activity for attribution (non-blocking)
        if (shot.projectId && user) {
          const statusLabel = shotStatusOptions.find((opt) => opt.value === newStatus)?.label || newStatus;
          logActivity(
            clientId,
            shot.projectId,
            createShotUpdatedActivity(
              user.uid,
              user.displayName || user.email || "Unknown",
              user.photoURL || null,
              shot.id,
              shot.name || "Untitled",
              { status: statusLabel }
            )
          ).catch((error) => {
            console.error("[ShotEditorHeaderBandV3] Activity logging failed for status change:", error);
          });
        }

        setStatusSaveState("saved");
        // Reset to idle after brief feedback
        setSafeTimeout(() => setStatusSaveState("idle"), 1500);
      } catch (error) {
        console.error("[ShotEditorHeaderBandV3] Failed to update status:", error);
        setStatusSaveState("idle");
      }
    },
    [clientId, shot?.id, shot?.projectId, shot?.name, currentStatus, readOnly, auth?.user]
  );

  /**
   * Apply suggested name to shot
   *
   * AUDIT PATTERN (per src/schemas/common.js:80-85):
   * - updatedBy: string (user UID only, not object triplet)
   * - updatedAt: serverTimestamp()
   *
   * Activity logging provides user attribution via createShotUpdatedActivity()
   */
  const handleApplySuggestedName = useCallback(async () => {
    if (!clientId || !shot?.id || !suggestedName || isApplying || readOnly) return;

    setIsApplying(true);

    try {
      const shotRef = doc(db, ...shotsPath(clientId), shot.id);
      const user = auth?.user;

      // Build update payload following schema audit pattern
      const updatePayload = {
        name: suggestedName,
        updatedAt: serverTimestamp(),
      };

      // Only write updatedBy if user exists (never write null)
      if (user?.uid) {
        updatePayload.updatedBy = user.uid;
      }

      await updateDoc(shotRef, updatePayload);

      // Log activity for attribution (non-blocking)
      if (shot.projectId && user) {
        logActivity(
          clientId,
          shot.projectId,
          createShotUpdatedActivity(
            user.uid,
            user.displayName || user.email || "Unknown",
            user.photoURL || null,
            shot.id,
            suggestedName, // Use new name for activity
            { name: suggestedName }
          )
        ).catch((error) => {
            console.error("[ShotEditorHeaderBandV3] Activity logging failed for suggested name:", error);
          });
      }

      // onSnapshot will update the shot and hide suggestion automatically
    } catch (error) {
      console.error("[ShotEditorHeaderBandV3] Failed to apply suggested name:", error);
    } finally {
      setIsApplying(false);
    }
  }, [clientId, shot?.id, shot?.projectId, suggestedName, isApplying, readOnly, auth?.user]);

  /**
   * Enter shot number edit mode
   */
  const handleStartEditingShotNumber = useCallback(() => {
    if (readOnly) return;
    setShotNumberDraft(shot?.shotNumber || "");
    setIsEditingShotNumber(true);
  }, [readOnly, shot?.shotNumber]);

  /**
   * Cancel shot number editing (revert to original)
   */
  const handleCancelShotNumberEdit = useCallback(() => {
    setIsEditingShotNumber(false);
    setShotNumberDraft("");
  }, []);

  /**
   * Commit shot number change
   *
   * VALIDATION (per schema src/schemas/shot.js:62):
   * - Trim whitespace
   * - Max 20 characters
   * - Empty string allowed (field is optional)
   *
   * AUDIT PATTERN (per src/schemas/common.js:80-85):
   * - updatedBy: string (user UID only, not object triplet)
   * - updatedAt: serverTimestamp()
   */
  const handleCommitShotNumber = useCallback(async () => {
    // Trim and validate
    const newValue = shotNumberDraft.trim().slice(0, 20);

    // Guard: no-op if same value (no write)
    const oldValue = shot?.shotNumber || "";
    if (newValue === oldValue) {
      setIsEditingShotNumber(false);
      setShotNumberDraft("");
      return;
    }

    // Guard: missing required data
    if (!clientId || !shot?.id) {
      setIsEditingShotNumber(false);
      setShotNumberDraft("");
      return;
    }

    setShotNumberSaveState("saving");

    try {
      const shotRef = doc(db, ...shotsPath(clientId), shot.id);
      const user = auth?.user;

      // Build update payload following schema audit pattern
      const updatePayload = {
        shotNumber: newValue,
        updatedAt: serverTimestamp(),
      };

      // Only write updatedBy if user exists (never write null)
      if (user?.uid) {
        updatePayload.updatedBy = user.uid;
      }

      await updateDoc(shotRef, updatePayload);

      // Log activity for attribution (non-blocking)
      if (shot.projectId && user) {
        logActivity(
          clientId,
          shot.projectId,
          createShotUpdatedActivity(
            user.uid,
            user.displayName || user.email || "Unknown",
            user.photoURL || null,
            shot.id,
            shot.name || "Untitled",
            { shotNumber: newValue || "(cleared)" }
          )
        ).catch((error) => {
            console.error("[ShotEditorHeaderBandV3] Activity logging failed for shot number:", error);
          });
      }

      setShotNumberSaveState("saved");
      setIsEditingShotNumber(false);
      setShotNumberDraft("");

      // Reset to idle after brief feedback
      setSafeTimeout(() => setShotNumberSaveState("idle"), 1500);
    } catch (error) {
      console.error("[ShotEditorHeaderBandV3] Failed to update shot number:", error);
      setShotNumberSaveState("error");
      // Reset error state after feedback
      setSafeTimeout(() => setShotNumberSaveState("idle"), 2000);
    }
  }, [clientId, shot?.id, shot?.projectId, shot?.shotNumber, shot?.name, shotNumberDraft, auth?.user]);

  /**
   * Handle keydown in shot number input
   * - Enter: commit
   * - Escape: cancel
   */
  const handleShotNumberKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCommitShotNumber();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelShotNumberEdit();
      }
    },
    [handleCommitShotNumber, handleCancelShotNumberEdit]
  );

  // ══════════════════════════════════════════════════════════════════════════
  // DESCRIPTION EDIT HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Enter description edit mode
   */
  const handleStartEditingDescription = useCallback(() => {
    if (readOnly) return;
    // Use description field only (type is legacy).
    // If the stored description is corrupt (HTML-ish or notes bleed), do not prefill it.
    setDescriptionDraft(isCorruptDescription ? "" : descriptionDisplayText);
    setIsEditingDescription(true);
  }, [readOnly, isCorruptDescription, descriptionDisplayText]);

  /**
   * Cancel description editing (revert to original)
   */
  const handleCancelDescriptionEdit = useCallback(() => {
    setIsEditingDescription(false);
    setDescriptionDraft("");
  }, []);

  /**
   * Commit description change
   *
   * VALIDATION (per schema src/schemas/shot.js:59):
   * - Trim whitespace
   * - Max 200 characters
   * - Empty string allowed (field is optional)
   *
   * AUDIT PATTERN (per src/schemas/common.js:80-85):
   * - updatedBy: string (user UID only, not object triplet)
   * - updatedAt: serverTimestamp()
   */
  const handleCommitDescription = useCallback(async () => {
    // Trim and validate (max 200 chars per schema)
    const newValue = descriptionDraft.trim().slice(0, 200);

    // Guard: no-op if same value (no write)
    const oldValue = typeof shot?.description === "string" ? shot.description : "";
    if (newValue === oldValue) {
      setIsEditingDescription(false);
      setDescriptionDraft("");
      return;
    }

    // Guard: missing required data
    if (!clientId || !shot?.id) {
      setIsEditingDescription(false);
      setDescriptionDraft("");
      return;
    }

    setDescriptionSaveState("saving");

    try {
      const shotRef = doc(db, ...shotsPath(clientId), shot.id);
      const user = auth?.user;

      // Build update payload following schema audit pattern
      const updatePayload = {
        description: newValue,
        updatedAt: serverTimestamp(),
      };

      // Only write updatedBy if user exists (never write null)
      if (user?.uid) {
        updatePayload.updatedBy = user.uid;
      }

      await updateDoc(shotRef, updatePayload);

      // Log activity for attribution (non-blocking)
      if (shot.projectId && user) {
        logActivity(
          clientId,
          shot.projectId,
          createShotUpdatedActivity(
            user.uid,
            user.displayName || user.email || "Unknown",
            user.photoURL || null,
            shot.id,
            shot.name || "Untitled",
            { description: newValue || "(cleared)" }
          )
        ).catch((error) => {
            console.error("[ShotEditorHeaderBandV3] Activity logging failed for description:", error);
          });
      }

      setDescriptionSaveState("saved");
      setIsEditingDescription(false);
      setDescriptionDraft("");

      // Reset to idle after brief feedback
      setSafeTimeout(() => setDescriptionSaveState("idle"), 1500);
    } catch (error) {
      console.error("[ShotEditorHeaderBandV3] Failed to update description:", error);
      setDescriptionSaveState("error");
      // Reset error state after feedback
      setSafeTimeout(() => setDescriptionSaveState("idle"), 2000);
    }
  }, [clientId, shot?.id, shot?.projectId, shot?.description, shot?.name, descriptionDraft, auth?.user]);

  const handleClearCorruptDescription = useCallback(async () => {
    if (readOnly) return;
    if (!clientId || !shot?.id) return;

    setDescriptionSaveState("saving");
    try {
      const shotRef = doc(db, ...shotsPath(clientId), shot.id);
      // User-invoked only; single-field update (no updatedAt/updatedBy mutations).
      await updateDoc(shotRef, { description: "" });
      toast.success({ title: "Description cleared" });
      setDescriptionSaveState("saved");
      setSafeTimeout(() => setDescriptionSaveState("idle"), 1500);
    } catch (error) {
      console.error("[ShotEditorHeaderBandV3] Failed to clear description:", error);
      toast.error({ title: "Failed to clear description" });
      setDescriptionSaveState("error");
      setSafeTimeout(() => setDescriptionSaveState("idle"), 2000);
    }
  }, [readOnly, clientId, shot?.id, setSafeTimeout]);

  /**
   * Handle keydown in description textarea
   * - Enter: commit (without shift for single-line feel, but preserving newlines on commit)
   * - Escape: cancel
   */
  const handleDescriptionKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleCommitDescription();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelDescriptionEdit();
      }
    },
    [handleCommitDescription, handleCancelDescriptionEdit]
  );

  // ══════════════════════════════════════════════════════════════════════════
  // DATE EDIT HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Enter date edit mode
   */
  const handleStartEditingDate = useCallback(() => {
    if (readOnly) return;
    setDateDraft(toDateInputValue(shot?.date) || "");
    setIsEditingDate(true);
  }, [readOnly, shot?.date]);

  /**
   * Cancel date editing (revert to original)
   */
  const handleCancelDateEdit = useCallback(() => {
    setIsEditingDate(false);
    setDateDraft("");
  }, []);

  /**
   * Commit date change
   *
   * VALIDATION:
   * - Empty string allowed (clears the date)
   * - Valid date string expected in YYYY-MM-DD format (native date input format)
   *
   * AUDIT PATTERN (per src/schemas/common.js:80-85):
   * - updatedBy: string (user UID only, not object triplet)
   * - updatedAt: serverTimestamp()
   *
   * Firestore persists date as Timestamp (via parseDateToTimestamp) or null if cleared.
   */
  const handleCommitDate = useCallback(async () => {
    // Trim the value (though date inputs typically don't have whitespace)
    const newValue = dateDraft.trim();

    // Guard: no-op if same value (no write)
    const oldValue = toDateInputValue(shot?.date) || "";
    if (newValue === oldValue) {
      setIsEditingDate(false);
      setDateDraft("");
      return;
    }

    // Guard: missing required data
    if (!clientId || !shot?.id) {
      setIsEditingDate(false);
      setDateDraft("");
      return;
    }

    setDateSaveState("saving");

    try {
      const shotRef = doc(db, ...shotsPath(clientId), shot.id);
      const user = auth?.user;

      // Build update payload following schema audit pattern
      // Convert date string to Firestore Timestamp, or null if empty
      let dateTimestamp = null;
      if (newValue) {
        try {
          dateTimestamp = parseDateToTimestamp(newValue);
        } catch (parseError) {
          console.error("[ShotEditorHeaderBandV3] Invalid date format:", parseError);
          setDateSaveState("error");
          setSafeTimeout(() => setDateSaveState("idle"), 2000);
          return;
        }
      }

      const updatePayload = {
        date: dateTimestamp,
        updatedAt: serverTimestamp(),
      };

      // Only write updatedBy if user exists (never write null)
      if (user?.uid) {
        updatePayload.updatedBy = user.uid;
      }

      await updateDoc(shotRef, updatePayload);

      // Log activity for attribution (non-blocking)
      if (shot.projectId && user) {
        logActivity(
          clientId,
          shot.projectId,
          createShotUpdatedActivity(
            user.uid,
            user.displayName || user.email || "Unknown",
            user.photoURL || null,
            shot.id,
            shot.name || "Untitled",
            { date: newValue || "(cleared)" }
          )
        ).catch((error) => {
            console.error("[ShotEditorHeaderBandV3] Activity logging failed for date:", error);
          });
      }

      setDateSaveState("saved");
      setIsEditingDate(false);
      setDateDraft("");

      // Reset to idle after brief feedback
      setSafeTimeout(() => setDateSaveState("idle"), 1500);
    } catch (error) {
      console.error("[ShotEditorHeaderBandV3] Failed to update date:", error);
      setDateSaveState("error");
      // Reset error state after feedback
      setSafeTimeout(() => setDateSaveState("idle"), 2000);
    }
  }, [clientId, shot?.id, shot?.projectId, shot?.date, shot?.name, dateDraft, auth?.user]);

  /**
   * Handle keydown in date input
   * - Enter: commit
   * - Escape: cancel
   */
  const handleDateKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCommitDate();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelDateEdit();
      }
    },
    [handleCommitDate, handleCancelDateEdit]
  );

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* ──────────────────────────────────────────────────────────
              LEFT GROUP: Back + Identity
              ────────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {/* Back button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="flex-shrink-0 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Shots
            </Button>

            {/* Return to affordance (J.6) - shown when returnTo query param is present */}
            {returnToContext && (
              <button
                type="button"
                onClick={handleReturnTo}
                className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                title={returnToContext.label}
              >
                <ArrowLeft className="w-3 h-3" />
                <span className="max-w-[120px] truncate">{returnToContext.label}</span>
              </button>
            )}

            {/* Divider */}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

            {/* Shot identity */}
            <div className="min-w-0 flex-1">
              {/* Shot name - prominent */}
              <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                {shot.name || <span className="text-slate-400 dark:text-slate-500 italic">Untitled</span>}
              </h1>

              {/* Description - editable inline */}
              {isEditingDescription ? (
                <div className="mt-0.5 max-w-md">
                  <textarea
                    ref={descriptionTextareaRef}
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    onKeyDown={handleDescriptionKeyDown}
                    onBlur={handleCancelDescriptionEdit}
                    maxLength={200}
                    rows={2}
                    className="w-full text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    placeholder="Add a short description…"
                  />
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                    Enter to save • Esc to cancel
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEditingDescription}
                  disabled={readOnly || descriptionSaveState === "saving"}
                  className={`group mt-0.5 text-left max-w-md transition-colors ${
                    readOnly
                      ? "cursor-default"
                      : "hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                  title={readOnly ? undefined : "Click to edit description"}
                >
                  <span className={`text-xs truncate block ${
                    descriptionSaveState === "saving" || descriptionSaveState === "saved" || descriptionSaveState === "error"
                      ? "text-slate-500 dark:text-slate-400"
                      : descriptionDisplayText
                        ? "text-slate-600 dark:text-slate-400"
                        : "text-slate-400 dark:text-slate-500 italic"
                  }`}>
                    {descriptionSaveState === "saving"
                      ? "Saving…"
                      : descriptionSaveState === "saved"
                        ? "Saved"
                        : descriptionSaveState === "error"
                          ? "Error"
                          : isCorruptDescription
                            ? "No description"
                            : descriptionDisplayText || "No description"}
                  </span>
                  {!readOnly && descriptionSaveState === "idle" && (
                    <Pencil className="w-3 h-3 inline-block ml-1 opacity-0 group-hover:opacity-50 transition-opacity" />
                  )}
                </button>
              )}

              {/* Variant chips row */}
              <div className="flex items-center gap-2 mt-0.5">
                {/* Colorway chip - derived from hero product when looks exist */}
                <Badge
                  variant="secondary"
                  className="text-[11px] px-2 py-0 h-5"
                  title={colorwayNeedsHeroHint ? "Set a hero in Looks for accurate colorway" : undefined}
                >
                  {colorwayLabel}
                </Badge>

                {/* Gender chip - NOT on shot schema, placeholder */}
                <Badge variant="secondary" className="text-[11px] px-2 py-0 h-5">
                  —
                </Badge>

                {/* Suggested name from hero product */}
                {showSuggestion && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                      Suggested: {suggestedName}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={handleApplySuggestedName}
                        disabled={isApplying}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50"
                      >
                        {isApplying ? "..." : "Apply"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────
              RIGHT GROUP: Type chips + Status + Shot # + Actions
              ────────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Content Type - NOT on shot schema */}
            <Badge variant="outline" className="text-[11px] px-2 py-0 h-5 text-slate-500 dark:text-slate-400">
              —
            </Badge>

            {/* Media Type - NOT on shot schema */}
            <Badge variant="outline" className="text-[11px] px-2 py-0 h-5 text-slate-500 dark:text-slate-400">
              —
            </Badge>

            {/* Divider */}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Status chip - editable via dropdown */}
            {readOnly ? (
              <StatusBadge variant={statusVariant}>
                {currentStatusOption.label}
              </StatusBadge>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-badge"
                    disabled={statusSaveState === "saving"}
                  >
                    <StatusBadge variant={statusVariant} className="cursor-pointer">
                      {statusSaveState === "saving" ? "Saving…" : statusSaveState === "saved" ? "Saved" : currentStatusOption.label}
                    </StatusBadge>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  {shotStatusOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => handleStatusChange(option.value)}
                      className="flex items-center justify-between"
                    >
                      <span>{option.label}</span>
                      {option.value === currentStatus && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Shot number - editable inline */}
            {isEditingShotNumber ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400 dark:text-slate-500">#</span>
                <input
                  type="text"
                  value={shotNumberDraft}
                  onChange={(e) => setShotNumberDraft(e.target.value)}
                  onKeyDown={handleShotNumberKeyDown}
                  onBlur={handleCancelShotNumberEdit}
                  maxLength={20}
                  autoFocus
                  className="w-16 text-xs tabular-nums px-1 py-0.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="S-01"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartEditingShotNumber}
                disabled={readOnly || shotNumberSaveState === "saving"}
                className={`group inline-flex items-center gap-1 text-xs tabular-nums transition-colors ${
                  readOnly
                    ? "text-slate-500 dark:text-slate-400 cursor-default"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
                title={readOnly ? undefined : "Click to edit shot number"}
              >
                <span>
                  {shotNumberSaveState === "saving"
                    ? "Saving…"
                    : shotNumberSaveState === "saved"
                      ? "Saved"
                      : shotNumberSaveState === "error"
                        ? "Error"
                        : shot.shotNumber
                          ? `#${shot.shotNumber}`
                          : "#—"}
                </span>
                {!readOnly && shotNumberSaveState === "idle" && (
                  <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                )}
              </button>
            )}

            {/* Date - editable inline */}
            {isEditingDate ? (
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <input
                  ref={dateInputRef}
                  type="date"
                  value={dateDraft}
                  onChange={(e) => setDateDraft(e.target.value)}
                  onKeyDown={handleDateKeyDown}
                  onBlur={handleCancelDateEdit}
                  className="w-[120px] text-xs tabular-nums px-1 py-0.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartEditingDate}
                disabled={readOnly || dateSaveState === "saving"}
                className={`group inline-flex items-center gap-1 text-xs tabular-nums transition-colors ${
                  readOnly
                    ? "text-slate-500 dark:text-slate-400 cursor-default"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
                title={readOnly ? undefined : "Click to edit date"}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {dateSaveState === "saving"
                    ? "Saving…"
                    : dateSaveState === "saved"
                      ? "Saved"
                      : dateSaveState === "error"
                        ? "Error"
                        : toDateInputValue(shot?.date) || "No date"}
                </span>
                {!readOnly && dateSaveState === "idle" && (
                  <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                )}
              </button>
            )}

            {/* Divider before actions */}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Duplicate button - disabled until feature implemented */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDuplicate}
              disabled
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 disabled:opacity-50"
              title="Duplicate shot (coming soon)"
            >
              <Copy className="w-4 h-4" />
            </Button>

            {/* More menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleOpenLegacy}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open legacy editor
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDuplicate} disabled className="opacity-50">
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate shot (coming soon)
                </DropdownMenuItem>
                {!readOnly && isCorruptDescription && (
                  <DropdownMenuItem onClick={handleClearCorruptDescription}>
                    <Eraser className="w-4 h-4 mr-2" />
                    Clear description
                  </DropdownMenuItem>
                )}
                {!readOnly && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleOpenDeleteConfirm}
                      className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete shot
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDelete}
        title="Delete shot"
        message={`Are you sure you want to delete "${shot?.name || "Untitled"}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        loading={isDeleting}
      />
    </header>
  );
}
