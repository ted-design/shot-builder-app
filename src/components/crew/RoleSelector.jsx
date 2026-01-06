import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * RoleSelector - SetHero-style two-column role picker
 *
 * A unified role selector that displays departments in the left column
 * and positions in the right column. Supports search/filtering, keyboard
 * navigation, and inline position creation.
 *
 * @param {Array} departments - Array of department objects with positions
 * @param {string} selectedDepartmentId - Currently selected department ID
 * @param {string} selectedPositionId - Currently selected position ID
 * @param {function} onSelect - Called with { departmentId, positionId } when selection is made
 * @param {function} onCreatePosition - Called with { departmentId, title } when new position is created
 * @param {string} placeholder - Placeholder text for the input
 * @param {boolean} disabled - Whether the selector is disabled
 * @param {string} className - Additional CSS classes
 */
export default function RoleSelector({
  departments = [],
  selectedDepartmentId = "",
  selectedPositionId = "",
  onSelect,
  onCreatePosition,
  placeholder = "Search positions...",
  disabled = false,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredDepartmentId, setHoveredDepartmentId] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState({ column: "departments", index: 0 });
  const [showNewPositionInput, setShowNewPositionInput] = useState(false);
  const [newPositionTitle, setNewPositionTitle] = useState("");

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const departmentRefs = useRef([]);
  const positionRefs = useRef([]);
  const newPositionInputRef = useRef(null);

  // Get display text for the selected role
  const displayText = useMemo(() => {
    if (!selectedDepartmentId || !selectedPositionId) return "";
    const dept = departments.find((d) => d.id === selectedDepartmentId);
    const pos = dept?.positions?.find((p) => p.id === selectedPositionId);
    if (!pos) return "";
    return `${pos.title}`;
  }, [departments, selectedDepartmentId, selectedPositionId]);

  // Active department (hovered or selected)
  const activeDepartmentId = hoveredDepartmentId || selectedDepartmentId || departments[0]?.id;

  // Filter departments and positions based on search
  const { filteredDepartments, flatPositions } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      return {
        filteredDepartments: departments,
        flatPositions: [],
      };
    }

    // When searching, collect all matching positions across departments
    const matchingPositions = [];
    const matchingDepartments = new Set();

    departments.forEach((dept) => {
      const deptMatches = dept.name.toLowerCase().includes(query);

      dept.positions?.forEach((pos) => {
        const posMatches = pos.title.toLowerCase().includes(query);
        if (deptMatches || posMatches) {
          matchingPositions.push({
            ...pos,
            departmentId: dept.id,
            departmentName: dept.name,
          });
          matchingDepartments.add(dept.id);
        }
      });
    });

    return {
      filteredDepartments: departments.filter((d) => matchingDepartments.has(d.id)),
      flatPositions: matchingPositions,
    };
  }, [departments, searchQuery]);

  // Get positions for the active department (when not searching)
  const activePositions = useMemo(() => {
    if (searchQuery.trim()) return [];
    const dept = departments.find((d) => d.id === activeDepartmentId);
    return dept?.positions || [];
  }, [departments, activeDepartmentId, searchQuery]);

  // Reset hover state when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setHoveredDepartmentId(selectedDepartmentId || departments[0]?.id || null);
      setFocusedIndex({ column: "departments", index: 0 });
      setShowNewPositionInput(false);
      setNewPositionTitle("");
    }
  }, [isOpen, selectedDepartmentId, departments]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event) => {
      if (!isOpen) {
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
          event.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      const isSearching = searchQuery.trim().length > 0;

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          setIsOpen(false);
          inputRef.current?.focus();
          break;

        case "ArrowDown":
          event.preventDefault();
          if (isSearching) {
            // Navigate flat list
            setFocusedIndex((prev) => ({
              column: "positions",
              index: Math.min(prev.index + 1, flatPositions.length - 1),
            }));
          } else if (focusedIndex.column === "departments") {
            setFocusedIndex((prev) => ({
              ...prev,
              index: Math.min(prev.index + 1, filteredDepartments.length - 1),
            }));
          } else {
            setFocusedIndex((prev) => ({
              ...prev,
              index: Math.min(prev.index + 1, activePositions.length - 1),
            }));
          }
          break;

        case "ArrowUp":
          event.preventDefault();
          setFocusedIndex((prev) => ({
            ...prev,
            index: Math.max(prev.index - 1, 0),
          }));
          break;

        case "ArrowRight":
          if (!isSearching && focusedIndex.column === "departments") {
            event.preventDefault();
            const dept = filteredDepartments[focusedIndex.index];
            if (dept) {
              setHoveredDepartmentId(dept.id);
              setFocusedIndex({ column: "positions", index: 0 });
            }
          }
          break;

        case "ArrowLeft":
          if (!isSearching && focusedIndex.column === "positions") {
            event.preventDefault();
            setFocusedIndex({ column: "departments", index: 0 });
          }
          break;

        case "Enter":
          event.preventDefault();
          if (isSearching) {
            const pos = flatPositions[focusedIndex.index];
            if (pos) {
              handleSelectPosition(pos.departmentId, pos.id);
            }
          } else if (focusedIndex.column === "positions") {
            const pos = activePositions[focusedIndex.index];
            if (pos) {
              handleSelectPosition(activeDepartmentId, pos.id);
            }
          } else if (focusedIndex.column === "departments") {
            const dept = filteredDepartments[focusedIndex.index];
            if (dept) {
              setHoveredDepartmentId(dept.id);
              setFocusedIndex({ column: "positions", index: 0 });
            }
          }
          break;

        case "Tab":
          setIsOpen(false);
          break;

        default:
          break;
      }
    },
    [isOpen, searchQuery, focusedIndex, filteredDepartments, activePositions, flatPositions, activeDepartmentId]
  );

  const handleSelectPosition = (departmentId, positionId) => {
    onSelect?.({ departmentId, positionId });
    setIsOpen(false);
    setSearchQuery("");
    inputRef.current?.blur();
  };

  const handleCreatePosition = async () => {
    if (!newPositionTitle.trim() || !activeDepartmentId) return;

    try {
      const result = await onCreatePosition?.({
        departmentId: activeDepartmentId,
        title: newPositionTitle.trim(),
      });

      if (result?.id) {
        handleSelectPosition(activeDepartmentId, result.id);
      }

      setShowNewPositionInput(false);
      setNewPositionTitle("");
    } catch (err) {
      console.error("Failed to create position:", err);
    }
  };

  const handleInputChange = (event) => {
    setSearchQuery(event.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleClear = () => {
    setSearchQuery("");
    onSelect?.({ departmentId: "", positionId: "" });
    inputRef.current?.focus();
  };

  // Scroll focused items into view
  useEffect(() => {
    if (!isOpen) return;

    if (focusedIndex.column === "departments" && departmentRefs.current[focusedIndex.index]) {
      departmentRefs.current[focusedIndex.index]?.scrollIntoView({ block: "nearest" });
    } else if (focusedIndex.column === "positions" && positionRefs.current[focusedIndex.index]) {
      positionRefs.current[focusedIndex.index]?.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, focusedIndex]);

  const isSearching = searchQuery.trim().length > 0;
  const activeDepartmentName = departments.find((d) => d.id === activeDepartmentId)?.name || "";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Input Field */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchQuery : displayText || searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-8 py-2 text-sm",
            "ring-offset-white placeholder:text-slate-500",
            "focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:border-slate-700 dark:bg-slate-800 dark:ring-offset-slate-900",
            "dark:placeholder:text-slate-400 dark:focus:ring-indigo-500"
          )}
          autoComplete="off"
        />
        {(displayText || searchQuery) && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            tabIndex={-1}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 z-[1100] mt-1 rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
          style={{ maxHeight: "400px" }}
        >
          {/* New Position Button */}
          {onCreatePosition && !isSearching && (
            <div className="border-b border-slate-200 dark:border-slate-700 p-2">
              {showNewPositionInput ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={newPositionInputRef}
                    type="text"
                    value={newPositionTitle}
                    onChange={(e) => setNewPositionTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreatePosition();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setShowNewPositionInput(false);
                        setNewPositionTitle("");
                      }
                    }}
                    placeholder={`New position in ${activeDepartmentName}...`}
                    className="flex-1 h-8 rounded border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreatePosition}
                    disabled={!newPositionTitle.trim()}
                    className="h-8 px-3 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewPositionInput(false);
                      setNewPositionTitle("");
                    }}
                    className="h-8 px-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewPositionInput(true);
                    setTimeout(() => newPositionInputRef.current?.focus(), 0);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary hover:bg-slate-100 dark:text-indigo-400 dark:hover:bg-slate-700"
                >
                  <Plus className="h-4 w-4" />
                  New position
                </button>
              )}
            </div>
          )}

          {/* Search Results (flat list) */}
          {isSearching ? (
            <div className="max-h-[320px] overflow-y-auto p-1">
              {flatPositions.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-slate-500">
                  No positions match "{searchQuery}"
                </div>
              ) : (
                flatPositions.map((pos, index) => (
                  <button
                    key={`${pos.departmentId}-${pos.id}`}
                    ref={(el) => (positionRefs.current[index] = el)}
                    type="button"
                    onClick={() => handleSelectPosition(pos.departmentId, pos.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm",
                      "hover:bg-slate-100 dark:hover:bg-slate-700",
                      focusedIndex.column === "positions" && focusedIndex.index === index &&
                        "bg-slate-100 dark:bg-slate-700",
                      pos.id === selectedPositionId && pos.departmentId === selectedDepartmentId &&
                        "bg-primary/10 text-primary dark:bg-indigo-900/30 dark:text-indigo-300"
                    )}
                  >
                    <span className="font-medium">{pos.title}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {pos.departmentName}
                    </span>
                  </button>
                ))
              )}

              {/* Add new position from search */}
              {onCreatePosition && searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setNewPositionTitle(searchQuery.trim());
                    setSearchQuery("");
                    setShowNewPositionInput(true);
                    setTimeout(() => newPositionInputRef.current?.focus(), 0);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-primary hover:bg-slate-100 dark:text-indigo-400 dark:hover:bg-slate-700 border-t border-slate-200 dark:border-slate-700 mt-1"
                >
                  <Plus className="h-4 w-4" />
                  Add "{searchQuery}" as new position
                </button>
              )}
            </div>
          ) : (
            /* Two-Column Layout */
            <div className="flex" style={{ maxHeight: "320px" }}>
              {/* Left Column: Departments */}
              <div className="w-1/2 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
                <div className="p-1">
                  {filteredDepartments.map((dept, index) => (
                    <button
                      key={dept.id}
                      ref={(el) => (departmentRefs.current[index] = el)}
                      type="button"
                      onMouseEnter={() => {
                        setHoveredDepartmentId(dept.id);
                        setFocusedIndex({ column: "departments", index });
                      }}
                      onClick={() => {
                        setHoveredDepartmentId(dept.id);
                        setFocusedIndex({ column: "positions", index: 0 });
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm",
                        "transition-colors",
                        dept.id === activeDepartmentId
                          ? "bg-slate-100 dark:bg-slate-700"
                          : "hover:bg-slate-50 dark:hover:bg-slate-700/50",
                        focusedIndex.column === "departments" && focusedIndex.index === index &&
                          "ring-2 ring-inset ring-primary/40"
                      )}
                    >
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {dept.name}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Positions */}
              <div className="w-1/2 overflow-y-auto">
                <div className="p-1">
                  {activePositions.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-slate-500">
                      No positions in this department
                    </div>
                  ) : (
                    activePositions.map((pos, index) => (
                      <button
                        key={pos.id}
                        ref={(el) => (positionRefs.current[index] = el)}
                        type="button"
                        onClick={() => handleSelectPosition(activeDepartmentId, pos.id)}
                        className={cn(
                          "flex w-full items-center rounded-md px-3 py-2 text-left text-sm",
                          "hover:bg-slate-100 dark:hover:bg-slate-700",
                          focusedIndex.column === "positions" && focusedIndex.index === index &&
                            "bg-slate-100 dark:bg-slate-700 ring-2 ring-inset ring-primary/40",
                          pos.id === selectedPositionId && activeDepartmentId === selectedDepartmentId &&
                            "bg-primary/10 text-primary dark:bg-indigo-900/30 dark:text-indigo-300"
                        )}
                      >
                        {pos.title}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Empty state when no departments */}
          {filteredDepartments.length === 0 && !isSearching && (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              No departments available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
