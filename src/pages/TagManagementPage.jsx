// src/pages/TagManagementPage.jsx
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { EmptyState } from "../components/ui/EmptyState";
import Modal from "../components/ui/modal";
import { Tag, Search, Edit2, Merge, Trash2, TrendingUp, X } from "lucide-react";
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

const PROJECT_GROUP_ID = "project";
const PROJECT_GROUP_LABEL = "Project Tags";
const DEFAULT_TAG_INDEX = new Map(DEFAULT_TAGS.map((tag) => [tag.id, tag]));
const DEFAULT_GROUP_LABELS = new Map(
  DEFAULT_TAG_GROUPS.map((group) => [group.id, group.label])
);
const DEFAULT_GROUP_DESCRIPTIONS = new Map(
  DEFAULT_TAG_GROUPS.map((group) => [group.id, group.description])
);

/**
 * TagManagementPage - Centralized tag library and management
 *
 * Features:
 * - View all tags across shots with usage counts
 * - Rename tags globally (updates all shots)
 * - Merge duplicate tags
 * - Delete unused tags
 * - Tag usage analytics
 */
export default function TagManagementPage() {
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState("gray");
  const [isRenaming, setIsRenaming] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState([]);
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
        const shotsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
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

  // Tag analytics
  const analytics = useMemo(() => {
    const totalTags = tagLibrary.length;
    const totalUsages = tagLibrary.reduce((sum, tag) => sum + tag.usageCount, 0);
    const unusedTags = tagLibrary.filter((tag) => tag.usageCount === 0 && !tag.isDefault).length;
    const mostUsedTag = tagLibrary.find((tag) => tag.usageCount > 0) || null;

    // Tags by color
    const colorDistribution = tagLibrary.reduce((acc, tag) => {
      const color = tag.color || "gray";
      acc[color] = (acc[color] || 0) + 1;
      return acc;
    }, {});

    return {
      totalTags,
      totalUsages,
      unusedTags,
      mostUsedTag,
      colorDistribution,
    };
  }, [tagLibrary]);

  // Rename tag globally
  const handleRenameTag = useCallback(async () => {
    if (!canEdit) {
      toast.error("You do not have permission to rename tags.");
      return;
    }

    if (!selectedTag) return;

    const trimmedLabel = newTagLabel.trim();
    if (!trimmedLabel) {
      toast.error("Tag label cannot be empty.");
      return;
    }

    if (trimmedLabel.length > 50) {
      toast.error("Tag label must be 50 characters or less.");
      return;
    }

    setIsRenaming(true);
    try {
      // Fetch all shots that have this tag
      const shotsToUpdate = shots.filter((shot) =>
        Array.isArray(shot.tags) && shot.tags.some((tag) => tag.id === selectedTag.id)
      );

      if (shotsToUpdate.length === 0) {
        toast.info("No shots use this tag.");
        setRenameModalOpen(false);
        return;
      }

      // Create batches (500 operations max per batch)
      let batch = writeBatch(db);
      let updateCount = 0;

      for (const shot of shotsToUpdate) {
        const updatedTags = shot.tags.map((tag) =>
          tag.id === selectedTag.id
            ? { ...tag, label: trimmedLabel, color: newTagColor }
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

      toast.success(`Renamed tag "${selectedTag.label}" to "${trimmedLabel}" across ${shotsToUpdate.length} shots.`);
      setRenameModalOpen(false);
      setSelectedTag(null);
      setNewTagLabel("");
      setNewTagColor("gray");
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to rename tag.");
      console.error("[Tags] Failed to rename tag", error);
      toast.error({ title: "Failed to rename tag", description: `${code}: ${message}` });
    } finally {
      setIsRenaming(false);
    }
  }, [canEdit, selectedTag, newTagLabel, newTagColor, shots, currentShotsPath]);

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
        `Merged ${selectedForMerge.length} tags into "${targetTag.label}" across ${shotsToUpdate.length} shots.`
      );
      setMergeModalOpen(false);
      setSelectedForMerge([]);
    } catch (error) {
      const { code, message} = describeFirebaseError(error, "Unable to merge tags.");
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

      toast.success(`Deleted tag "${tagToDelete.label}" from ${shotsToUpdate.length} shots.`);
      setDeleteModalOpen(false);
      setTagToDelete(null);
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to delete tag.");
      console.error("[Tags] Failed to delete tag", error);
      toast.error({ title: "Failed to delete tag", description: `${code}: ${message}` });
    } finally {
      setIsDeleting(false);
    }
  }, [canEdit, tagToDelete, shots, currentShotsPath]);

  // Open rename modal
  const openRenameModal = useCallback(
    (tag) => {
      if (!canEdit) return;
      setSelectedTag(tag);
      setNewTagLabel(tag.label);
      setNewTagColor(tag.color || "gray");
      setRenameModalOpen(true);
    },
    [canEdit]
  );

  // Open delete modal
  const openDeleteModal = useCallback(
    (tag) => {
      if (!canEdit) return;
      if (tag.isDefault) {
        toast.info("Default tags are always available and can't be deleted.");
        return;
      }
      setTagToDelete(tag);
      setDeleteModalOpen(true);
    },
    [canEdit]
  );

  // Toggle tag selection for merge
  const toggleMergeSelection = useCallback((tagId) => {
    setSelectedForMerge((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-slate-600 dark:text-slate-400">Loading tags...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sticky inset-x-0 top-14 z-40 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100 truncate">Tag Management</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Centralized tag library with global rename, merge, and delete operations
              </p>
            </div>
            <div className="relative min-w-[200px] max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search tags..."
                aria-label="Search tags"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-10"
              />
            </div>
            {canEdit && (
              <Button
                onClick={() => setMergeModalOpen(true)}
                variant="outline"
                disabled={selectedForMerge.length < 2}
                className="flex-none whitespace-nowrap"
              >
                <Merge className="h-4 w-4 mr-2" />
                Merge Tags ({selectedForMerge.length})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="mx-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Tag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Tags</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{analytics.totalTags}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Usages</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{analytics.totalUsages}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2">
                <Tag className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Most Used</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate" title={analytics.mostUsedTag?.label}>
                  {analytics.mostUsedTag ? analytics.mostUsedTag.label : "—"}
                </p>
                {analytics.mostUsedTag && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{analytics.mostUsedTag.usageCount} shots</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-slate-100 dark:bg-slate-700 p-2">
                <Trash2 className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Unused Tags</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{analytics.unusedTags}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tag Library Table */}
      <div className="mx-6">
        {filteredTags.length === 0 ? (
          tagLibrary.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No tags yet"
              description="Tags will appear here once you add them to shots. Visit the Shots page to create and assign tags."
              action="Go to Shots"
              onAction={() => navigate("/shots")}
            />
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No tags match your search.
              </CardContent>
            </Card>
          )
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tag Library</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Showing {filteredTags.length} of {tagLibrary.length} tags
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr>
                      {canEdit && (
                        <th scope="col" className="px-4 py-3 w-10">
                          <span className="sr-only">Select for merge</span>
                        </th>
                      )}
                      <th scope="col" className="px-4 py-3">Tag</th>
                      <th scope="col" className="px-4 py-3">Usage</th>
                      <th scope="col" className="px-4 py-3">Color</th>
                      {canEdit && (
                        <th scope="col" className="px-4 py-3 text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                    {filteredTags.map((tag) => (
                      <tr key={tag.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                        {canEdit && (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                              checked={selectedForMerge.includes(tag.id)}
                              onChange={() => toggleMergeSelection(tag.id)}
                              aria-label={`Select ${tag.label} for merge`}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <TagBadge tag={tag} />
                              {tag.isDefault && (
                                <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                  Default
                                </span>
                              )}
                            </div>
                            {tag.groupLabel && (
                              <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                {tag.groupLabel}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-900 dark:text-slate-100">{tag.usageCount}</span>
                          <span className="text-slate-500 dark:text-slate-400"> shots</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 capitalize">
                            <span
                              className={`h-4 w-4 rounded-full border ${getTagSwatchClasses(tag.color)}`}
                              aria-label={tag.color}
                            />
                            {tag.color || "gray"}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openRenameModal(tag)}
                                title="Rename tag"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openDeleteModal(tag)}
                                title={tag.isDefault ? "Default tags cannot be deleted" : "Delete tag"}
                                className={`text-red-600 hover:text-red-700 hover:bg-red-50 ${
                                  tag.isDefault ? "pointer-events-none opacity-40" : ""
                                }`}
                                disabled={tag.isDefault}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Rename Modal */}
      {canEdit && renameModalOpen && selectedTag && (
        <Modal
          open={renameModalOpen}
          onClose={() => {
            if (isRenaming) return;
            setRenameModalOpen(false);
            setSelectedTag(null);
            setNewTagLabel("");
            setNewTagColor("gray");
          }}
          labelledBy="rename-tag-title"
          closeOnOverlay={!isRenaming}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100" id="rename-tag-title">
                Rename Tag
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                This will update the tag across all {selectedTag.usageCount} shots.
              </p>
            </div>
            <div className="flex-1 px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Current Tag
                </label>
                <TagBadge tag={selectedTag} />
              </div>
              <div>
                <label htmlFor="new-tag-label" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  New Label
                </label>
                <Input
                  id="new-tag-label"
                  value={newTagLabel}
                  onChange={(e) => setNewTagLabel(e.target.value)}
                  placeholder="Enter new tag label..."
                  maxLength={50}
                  autoFocus
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{newTagLabel.length}/50 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  New Color
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {Object.keys(TAG_COLORS).map((color) => {
                    const swatchClasses = getTagSwatchClasses(color);
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewTagColor(color)}
                        className={`h-10 w-full rounded border-2 transition ${swatchClasses} ${
                          newTagColor === color
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
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Preview
                </label>
                <TagBadge tag={{ id: selectedTag.id, label: newTagLabel || selectedTag.label, color: newTagColor }} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRenameModalOpen(false);
                  setSelectedTag(null);
                  setNewTagLabel("");
                  setNewTagColor("gray");
                }}
                disabled={isRenaming}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleRenameTag}
                disabled={isRenaming || !newTagLabel.trim() || newTagLabel.trim().length > 50}
              >
                {isRenaming ? "Renaming..." : "Rename Tag"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

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
                  Select at least 2 tags from the table to merge them.
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
