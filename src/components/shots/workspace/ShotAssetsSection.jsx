/**
 * ShotAssetsSection - Editable assets section for Talent, Location, and Tags
 *
 * DESIGN PHILOSOPHY
 * =================
 * Per design-spec.md: "Supporting Sections (Logistics, Talent, etc.)" are
 * collapsed by default and clearly marked as secondary.
 *
 * This component provides editing for three asset types:
 * - Talent (multi-select)
 * - Location (single-select)
 * - Tags (tag editor with autocomplete)
 *
 * EDIT PATTERN (consistent across all three)
 * ==========================================
 * 1. Display mode: Shows current assignments with "Edit" button
 * 2. Edit mode: Shows the picker/editor component
 * 3. Save: Commits changes to Firestore
 * 4. Cancel: Restores previous state without write
 *
 * PATTERNS REUSED
 * ===============
 * - TalentMultiSelect from components/shots
 * - LocationSelect from components/shots
 * - TagEditor from components/shots
 * - sanitizeForFirestore pattern from ShotLooksCanvas
 * - Direct updateDoc pattern from ShotNotesCanvas/ShotLooksCanvas
 */

import { useState, useCallback, useMemo } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "../../../lib/firebase";
import { shotsPath } from "../../../lib/paths";
import { useAuth } from "../../../context/AuthContext";
import { queryKeys } from "../../../hooks/useFirestoreQuery";
import { logActivity, createShotUpdatedActivity } from "../../../lib/activityLogger";
import { updateShotWithVersion } from "../../../lib/updateShotWithVersion";
import { toast } from "../../../lib/toast";
import TalentMultiSelect from "../TalentMultiSelect";
import LocationSelect from "../LocationSelect";
import { TagEditor } from "../TagEditor";
import { TagList } from "../../ui/TagBadge";
import Avatar from "../../ui/Avatar";
import Thumb from "../../Thumb";
import { Button } from "../../ui/button";
import {
  Users,
  MapPin,
  Tags,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Recursively removes undefined values from an object or array.
 * Firestore rejects documents containing undefined values.
 * Reused pattern from ShotLooksCanvas.jsx.
 */
function sanitizeForFirestore(value) {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForFirestore);
  }
  if (typeof value === "object" && value !== null) {
    const result = {};
    for (const key of Object.keys(value)) {
      const v = value[key];
      if (v !== undefined) {
        result[key] = sanitizeForFirestore(v);
      }
    }
    return result;
  }
  return value;
}

// ============================================================================
// INDIVIDUAL ASSET EDITORS
// ============================================================================

/**
 * TalentAssetEditor - Edit talent assignments
 */
function TalentAssetEditor({
  shot,
  talentOptions,
  readOnly,
  onSave,
  isSaving,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTalent, setDraftTalent] = useState(shot?.talent || []);

  const currentTalent = shot?.talent || [];
  const talentCount = currentTalent.length;

  const handleStartEdit = useCallback(() => {
    setDraftTalent(shot?.talent || []);
    setIsEditing(true);
  }, [shot?.talent]);

  const handleCancel = useCallback(() => {
    setDraftTalent(shot?.talent || []);
    setIsEditing(false);
  }, [shot?.talent]);

  const handleSave = useCallback(async () => {
    await onSave({ talent: draftTalent });
    setIsEditing(false);
  }, [draftTalent, onSave]);

  if (readOnly) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Talent
            </span>
          </div>
        </div>
        {talentCount > 0 ? (
          <div className="flex flex-wrap gap-2">
            {currentTalent.map((t) => (
              <div
                key={t.talentId}
                className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-xs text-slate-600 dark:text-slate-300"
              >
                <Avatar name={t.name} size="xs" />
                <span>{t.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No talent assigned
          </p>
        )}
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Talent
            </span>
            {talentCount > 0 && (
              <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-slate-200/80 text-slate-500 dark:bg-slate-600 dark:text-slate-300">
                {talentCount}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartEdit}
            className="h-7 px-2 text-xs"
          >
            <Pencil className="w-3 h-3 mr-1" />
            Edit
          </Button>
        </div>
        {talentCount > 0 ? (
          <div className="flex flex-wrap gap-2">
            {currentTalent.map((t) => (
              <div
                key={t.talentId}
                className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-xs text-slate-600 dark:text-slate-300"
              >
                <Avatar name={t.name} size="xs" />
                <span>{t.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No talent assigned
          </p>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Talent
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-7 px-2 text-xs"
          >
            <X className="w-3 h-3 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-7 px-2 text-xs"
          >
            {isSaving ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Check className="w-3 h-3 mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>
      <TalentMultiSelect
        options={talentOptions}
        value={draftTalent}
        onChange={setDraftTalent}
        placeholder="Select talent..."
        isDisabled={isSaving}
      />
    </div>
  );
}

/**
 * LocationAssetEditor - Edit location selection
 */
function LocationAssetEditor({
  shot,
  locationOptions,
  readOnly,
  onSave,
  isSaving,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftLocationId, setDraftLocationId] = useState(shot?.locationId || "");

  const currentLocationId = shot?.locationId || "";
  const currentLocation = locationOptions.find((loc) => loc.id === currentLocationId);

  const handleStartEdit = useCallback(() => {
    setDraftLocationId(shot?.locationId || "");
    setIsEditing(true);
  }, [shot?.locationId]);

  const handleCancel = useCallback(() => {
    setDraftLocationId(shot?.locationId || "");
    setIsEditing(false);
  }, [shot?.locationId]);

  const handleSave = useCallback(async () => {
    await onSave({ locationId: draftLocationId || null });
    setIsEditing(false);
  }, [draftLocationId, onSave]);

  if (readOnly) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Location
            </span>
          </div>
        </div>
        {currentLocation ? (
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            {currentLocation.photoPath ? (
              <div className="h-6 w-6 overflow-hidden rounded-md bg-slate-100">
                <Thumb
                  path={currentLocation.photoPath}
                  size={96}
                  alt={currentLocation.name}
                  className="h-6 w-6"
                  imageClassName="h-full w-full object-cover"
                />
              </div>
            ) : (
              <Avatar name={currentLocation.name} size="xs" />
            )}
            <span>{currentLocation.name}</span>
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No location selected
          </p>
        )}
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Location
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartEdit}
            className="h-7 px-2 text-xs"
          >
            <Pencil className="w-3 h-3 mr-1" />
            Edit
          </Button>
        </div>
        {currentLocation ? (
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            {currentLocation.photoPath ? (
              <div className="h-6 w-6 overflow-hidden rounded-md bg-slate-100">
                <Thumb
                  path={currentLocation.photoPath}
                  size={96}
                  alt={currentLocation.name}
                  className="h-6 w-6"
                  imageClassName="h-full w-full object-cover"
                />
              </div>
            ) : (
              <Avatar name={currentLocation.name} size="xs" />
            )}
            <span>{currentLocation.name}</span>
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No location selected
          </p>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Location
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-7 px-2 text-xs"
          >
            <X className="w-3 h-3 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-7 px-2 text-xs"
          >
            {isSaving ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Check className="w-3 h-3 mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>
      <LocationSelect
        options={locationOptions}
        value={draftLocationId}
        onChange={setDraftLocationId}
        placeholder="Select location..."
        isDisabled={isSaving}
      />
    </div>
  );
}

/**
 * TagsAssetEditor - Edit tags
 */
function TagsAssetEditor({
  shot,
  clientId,
  projectId,
  readOnly,
  onSave,
  isSaving,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTags, setDraftTags] = useState(shot?.tags || []);

  const currentTags = shot?.tags || [];
  const tagCount = currentTags.length;

  const handleStartEdit = useCallback(() => {
    setDraftTags(shot?.tags || []);
    setIsEditing(true);
  }, [shot?.tags]);

  const handleCancel = useCallback(() => {
    setDraftTags(shot?.tags || []);
    setIsEditing(false);
  }, [shot?.tags]);

  const handleSave = useCallback(async () => {
    await onSave({ tags: draftTags });
    setIsEditing(false);
  }, [draftTags, onSave]);

  if (readOnly) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tags className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Tags
            </span>
          </div>
        </div>
        {tagCount > 0 ? (
          <TagList tags={currentTags} />
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No tags added
          </p>
        )}
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tags className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Tags
            </span>
            {tagCount > 0 && (
              <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-slate-200/80 text-slate-500 dark:bg-slate-600 dark:text-slate-300">
                {tagCount}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartEdit}
            className="h-7 px-2 text-xs"
          >
            <Pencil className="w-3 h-3 mr-1" />
            Edit
          </Button>
        </div>
        {tagCount > 0 ? (
          <TagList tags={currentTags} />
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No tags added
          </p>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tags className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Tags
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-7 px-2 text-xs"
          >
            <X className="w-3 h-3 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-7 px-2 text-xs"
          >
            {isSaving ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Check className="w-3 h-3 mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>
      <TagEditor
        tags={draftTags}
        onChange={setDraftTags}
        clientId={clientId}
        projectId={projectId}
      />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ShotAssetsSection - Collapsible section for editing shot assets
 *
 * @param {Object} props
 * @param {Object} props.shot - Shot document
 * @param {Array} props.talentOptions - Available talent options
 * @param {Array} props.locationOptions - Available location options
 * @param {boolean} props.readOnly - Whether the section is read-only
 */
export default function ShotAssetsSection({
  shot,
  talentOptions = [],
  locationOptions = [],
  readOnly = false,
}) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { user, clientId } = useAuth();
  const queryClient = useQueryClient();

  const projectId = shot?.projectId;

  /**
   * Save handler for all asset types
   * Uses consistent pattern: sanitize -> updateDoc -> invalidate cache -> log activity
   */
  const handleSave = useCallback(
    async (updates) => {
      if (!shot?.id || !clientId) {
        toast.error({ title: "Cannot save", description: "Missing shot or client information" });
        return;
      }

      setIsSaving(true);

      try {
        const sanitizedUpdates = sanitizeForFirestore(updates);

        await updateShotWithVersion({
          clientId,
          shotId: shot.id,
          patch: sanitizedUpdates,
          shot,
          user,
          source: "ShotAssetsSection",
        });

        // Invalidate cache so other views reflect changes
        if (projectId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.shots(clientId, projectId),
          });
        }

        // Log activity
        if (projectId && user) {
          const shotName = shot.name || `Shot ${shot.shotNumber || shot.id}`;
          const activityData = createShotUpdatedActivity(
            user.uid,
            user.displayName || user.email || "Unknown User",
            user.photoURL || null,
            shot.id,
            shotName,
            updates
          );
          logActivity(clientId, projectId, activityData).catch((error) => {
            console.error("[ShotAssetsSection] Activity logging failed:", error);
          });
        }

        toast.success({ title: "Changes saved" });
      } catch (error) {
        console.error("[ShotAssetsSection] Save failed:", error);
        toast.error({
          title: "Failed to save",
          description: error.message || "Please try again",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [shot, clientId, projectId, user, queryClient]
  );

  // Calculate total assets count for badge
  const totalCount = useMemo(() => {
    const talentCount = shot?.talent?.length || 0;
    const hasLocation = shot?.locationId ? 1 : 0;
    const tagCount = shot?.tags?.length || 0;
    return talentCount + hasLocation + tagCount;
  }, [shot?.talent, shot?.locationId, shot?.tags]);

  return (
    <section className="border-t border-slate-100 dark:border-slate-700/50 pt-4">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 w-full text-left group"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
        )}
        <Users className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">
          Assets
        </span>
        {totalCount > 0 && (
          <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-slate-200/80 text-slate-500 dark:bg-slate-600 dark:text-slate-300">
            {totalCount}
          </span>
        )}
      </button>
      {!isCollapsed && (
        <div className="mt-4 ml-6 pl-4 border-l-2 border-slate-100 dark:border-slate-700/50 space-y-6">
          {/* Talent Editor */}
          <TalentAssetEditor
            shot={shot}
            talentOptions={talentOptions}
            readOnly={readOnly}
            onSave={handleSave}
            isSaving={isSaving}
          />

          {/* Location Editor */}
          <LocationAssetEditor
            shot={shot}
            locationOptions={locationOptions}
            readOnly={readOnly}
            onSave={handleSave}
            isSaving={isSaving}
          />

          {/* Tags Editor */}
          <TagsAssetEditor
            shot={shot}
            clientId={clientId}
            projectId={projectId}
            readOnly={readOnly}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </div>
      )}
    </section>
  );
}
