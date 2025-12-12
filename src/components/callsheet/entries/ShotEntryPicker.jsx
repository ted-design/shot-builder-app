// src/components/callsheet/entries/ShotEntryPicker.jsx
// Panel for selecting existing shots to add to the schedule with multi-select support

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Search, Camera, Loader2, CheckSquare, Square, X, ChevronDown, User, Tag } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import ShotPickerCard from "./ShotPickerCard";

function resolveTalentName(talentItem, talentMap) {
  if (!talentItem) return null;
  if (typeof talentItem === "string") {
    const talent = talentMap.get(talentItem);
    return talent?.name || talentItem;
  }
  if (typeof talentItem === "object") {
    return talentItem.name || talentMap.get(talentItem.talentId)?.name || talentItem.talentId || null;
  }
  return null;
}

/**
 * ShotEntryPicker - Panel content for selecting shots to add to schedule
 * Supports multi-select workflow with "Add Selected" action
 *
 * @param {object} props
 * @param {Array} props.shots - Array of shot objects from the project
 * @param {boolean} props.loading - Whether shots are loading
 * @param {Array} props.existingEntries - Entries already in schedule (to show which are added)
 * @param {Array} props.tracks - Available tracks to add to
 * @param {Map} props.talentMap - Map of talent ID to talent data
 * @param {Map} props.productsMap - Map of product ID to product data
 * @param {Function} props.onSelectShot - Callback when shot is selected (shotId, trackId)
 * @param {Function} props.onClose - Callback to close the picker
 */
function ShotEntryPicker({
  shots = [],
  loading = false,
  existingEntries = [],
  tracks = [],
  talentMap = new Map(),
  productsMap = new Map(),
  onSelectShot,
  onClose,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const initialTrackId = useMemo(() => {
    return (
      tracks.find((t) => t.scope !== "shared" && t.id !== "shared")?.id ||
      tracks[0]?.id ||
      "shared"
    );
  }, [tracks]);
  const [selectedTrackId, setSelectedTrackId] = useState(initialTrackId);
  const [selectedShotIds, setSelectedShotIds] = useState(new Set());
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!tracks.some((t) => t.id === selectedTrackId)) {
      setSelectedTrackId(initialTrackId);
    }
  }, [tracks, selectedTrackId, initialTrackId]);

  // Filter state
  const [talentFilter, setTalentFilter] = useState(null);
  const [tagFilter, setTagFilter] = useState(null);

  // Get set of shot IDs already in schedule
  const existingShotIds = useMemo(() => {
    return new Set(
      existingEntries
        .filter((e) => e.type === "shot" && e.shotRef)
        .map((e) => e.shotRef)
    );
  }, [existingEntries]);

  // Extract unique talent names from all shots
  const uniqueTalent = useMemo(() => {
    const talentSet = new Set();
    shots.forEach((shot) => {
      (shot.talent || []).forEach((talentItem) => {
        const name = resolveTalentName(talentItem, talentMap);
        if (name) talentSet.add(name);
      });
    });
    return Array.from(talentSet).sort();
  }, [shots, talentMap]);

  // Extract unique tags from all shots
  const uniqueTags = useMemo(() => {
    const tagSet = new Set();
    shots.forEach((shot) => {
      (shot.tags || []).forEach((tag) => {
        const name = typeof tag === "string" ? tag : tag.name || tag.label;
        if (name) tagSet.add(name);
      });
    });
    return Array.from(tagSet).sort();
  }, [shots]);

  // Filter shots by search query and dropdown filters
  const filteredShots = useMemo(() => {
    let result = shots;

    // Apply talent filter
    if (talentFilter) {
      result = result.filter((shot) => {
        return (shot.talent || []).some(
          (talentItem) => resolveTalentName(talentItem, talentMap) === talentFilter
        );
      });
    }

    // Apply tag filter
    if (tagFilter) {
      result = result.filter((shot) => {
        return (shot.tags || []).some((tag) => {
          const name = typeof tag === "string" ? tag : tag.name || tag.label;
          return name === tagFilter;
        });
      });
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((shot) => {
        // Search by shot number
        if (shot.shotNumber?.toString().includes(query)) return true;

        // Search by name
        if (shot.name?.toLowerCase().includes(query)) return true;

        // Search by description
        if (shot.description?.toLowerCase().includes(query)) return true;

        // Search by talent names
        const talentNames = (shot.talent || [])
          .map((talentItem) => resolveTalentName(talentItem, talentMap))
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (talentNames.includes(query)) return true;

        // Search by product names (shot.products is array of objects, not IDs)
        const productNames = (shot.products || [])
          .map((product) => product?.familyName || product?.productName)
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (productNames.includes(query)) return true;

        // Search by tags
        const tagNames = (shot.tags || [])
          .map((t) => (typeof t === "string" ? t : t.name || t.label))
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (tagNames.includes(query)) return true;

        return false;
      });
    }

    return result;
  }, [shots, searchQuery, talentMap, talentFilter, tagFilter]);

  // Get available shots (not already added)
  const availableShots = useMemo(() => {
    return filteredShots.filter((shot) => !existingShotIds.has(shot.id));
  }, [filteredShots, existingShotIds]);

  // Get selected track
  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) || tracks[0];

  // Toggle shot selection
  const handleToggleShot = useCallback((shotId) => {
    setSelectedShotIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(shotId)) {
        newSet.delete(shotId);
      } else {
        newSet.add(shotId);
      }
      return newSet;
    });
  }, []);

  // Select all available shots
  const handleSelectAll = useCallback(() => {
    const availableIds = availableShots.map((s) => s.id);
    setSelectedShotIds(new Set(availableIds));
  }, [availableShots]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedShotIds(new Set());
  }, []);

  // Add selected shots
  const handleAddSelected = useCallback(async () => {
    if (selectedShotIds.size === 0) return;

    setIsAdding(true);
    try {
      // Add shots sequentially to maintain order
      for (const shotId of selectedShotIds) {
        await onSelectShot(shotId, selectedTrackId);
      }
      setSelectedShotIds(new Set());
    } catch (error) {
      console.error("Failed to add shots:", error);
    } finally {
      setIsAdding(false);
    }
  }, [selectedShotIds, selectedTrackId, onSelectShot]);

  // Check if all available shots are selected
  const allSelected = availableShots.length > 0 &&
    availableShots.every((s) => selectedShotIds.has(s.id));

  return (
    <div className="flex h-full flex-col">
      {/* Header with search and track selector */}
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Search shots by name, talent, products, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Talent filter */}
          {uniqueTalent.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={talentFilter ? "secondary" : "outline"}
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                >
                  <User className="h-3.5 w-3.5" />
                  {talentFilter || "Talent"}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                <DropdownMenuItem onClick={() => setTalentFilter(null)}>
                  All Talent
                </DropdownMenuItem>
                {uniqueTalent.map((name) => (
                  <DropdownMenuItem
                    key={name}
                    onClick={() => setTalentFilter(name)}
                    className="gap-2"
                  >
                    {name}
                    {talentFilter === name && (
                      <CheckSquare className="ml-auto h-4 w-4 text-amber-600" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Tag filter */}
          {uniqueTags.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={tagFilter ? "secondary" : "outline"}
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                >
                  <Tag className="h-3.5 w-3.5" />
                  {tagFilter || "Tags"}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                <DropdownMenuItem onClick={() => setTagFilter(null)}>
                  All Tags
                </DropdownMenuItem>
                {uniqueTags.map((name) => (
                  <DropdownMenuItem
                    key={name}
                    onClick={() => setTagFilter(name)}
                    className="gap-2"
                  >
                    {name}
                    {tagFilter === name && (
                      <CheckSquare className="ml-auto h-4 w-4 text-amber-600" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Clear filters button */}
          {(talentFilter || tagFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTalentFilter(null);
                setTagFilter(null);
              }}
              className="h-8 gap-1 text-xs text-slate-500"
            >
              <X className="h-3 w-3" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Selection actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={allSelected ? handleClearSelection : handleSelectAll}
            disabled={availableShots.length === 0}
            className="gap-1.5 text-sm"
          >
            {allSelected ? (
              <>
                <Square className="h-4 w-4" />
                Clear All
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4" />
                Select All
              </>
            )}
          </Button>
          {selectedShotIds.size > 0 && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {selectedShotIds.size} selected
            </span>
          )}
        </div>
      </div>

      {/* Shot list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-500">
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-slate-400" />
            <p className="text-sm">Loading shots...</p>
          </div>
        ) : filteredShots.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-500">
            <Camera className="mb-2 h-12 w-12 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">
              {searchQuery ? "No shots match your search" : "No shots available"}
            </p>
            {searchQuery && (
              <p className="mt-1 text-xs text-slate-400">
                Try a different search term
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredShots.map((shot) => (
              <ShotPickerCard
                key={shot.id}
                shot={shot}
                isSelected={selectedShotIds.has(shot.id)}
                isAlreadyAdded={existingShotIds.has(shot.id)}
                onToggle={handleToggleShot}
                talentMap={talentMap}
                productsMap={productsMap}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {filteredShots.length} shot{filteredShots.length !== 1 ? "s" : ""}
          {availableShots.length < filteredShots.length && (
            <span> ({existingShotIds.size} already added)</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAddSelected}
            disabled={selectedShotIds.size === 0 || isAdding}
            className="gap-2"
          >
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                Add {selectedShotIds.size > 0 ? selectedShotIds.size : ""} Shot
                {selectedShotIds.size !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ShotEntryPicker;
