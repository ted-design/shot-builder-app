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

import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { shotsPath } from "../../../lib/paths";
import { useAuth } from "../../../context/AuthContext";
import { logActivity, createShotUpdatedActivity } from "../../../lib/activityLogger";
import { shotStatusOptions, normaliseShotStatus } from "../../../lib/shotStatus";
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
} from "lucide-react";

export default function ShotEditorHeaderBandV3({ shot, projectId, readOnly = false }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const clientId = auth?.clientId;

  const [isApplying, setIsApplying] = useState(false);
  const [statusSaveState, setStatusSaveState] = useState("idle"); // idle | saving | saved

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

  const handleOpenLegacy = () => {
    // Navigate to the shots list (legacy uses modal-based editing)
    navigate(`/projects/${projectId}/shots`);
  };

  const handleDuplicate = () => {
    // TODO: Implement shot duplication - opens duplicate modal
  };

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
          ).catch(() => {
            // Activity logging failures are non-critical
          });
        }

        setStatusSaveState("saved");
        // Reset to idle after brief feedback
        setTimeout(() => setStatusSaveState("idle"), 1500);
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
        ).catch(() => {
          // Activity logging failures are non-critical
        });
      }

      // onSnapshot will update the shot and hide suggestion automatically
    } catch (error) {
      console.error("[ShotEditorHeaderBandV3] Failed to apply suggested name:", error);
    } finally {
      setIsApplying(false);
    }
  }, [clientId, shot?.id, shot?.projectId, suggestedName, isApplying, readOnly, auth?.user]);

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

            {/* Divider */}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

            {/* Shot identity */}
            <div className="min-w-0 flex-1">
              {/* Shot name - prominent */}
              <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                {shot.name || <span className="text-slate-400 dark:text-slate-500 italic">Untitled</span>}
              </h1>

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

            {/* Shot number - quiet secondary */}
            {shot.shotNumber && (
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                #{shot.shotNumber}
              </span>
            )}

            {/* Divider before actions */}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Duplicate button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDuplicate}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              title="Duplicate shot"
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
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate shot
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
