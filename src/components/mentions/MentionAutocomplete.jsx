import React, { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import Avatar from "../ui/Avatar";

/**
 * MentionAutocomplete - Dropdown for selecting users to mention
 *
 * @param {object} props
 * @param {Array<{id: string, displayName: string, email: string, photoURL?: string}>} props.users - Available users to mention
 * @param {string} props.query - Current search query (text after @)
 * @param {function} props.onSelect - Callback when user is selected (user) => void
 * @param {function} props.onClose - Callback when dropdown should close
 * @param {{x: number, y: number}} [props.position] - Position for dropdown
 * @param {boolean} [props.isLoading] - Whether users are loading
 */
export default function MentionAutocomplete({
  users = [],
  query = "",
  onSelect,
  onClose,
  position = { x: 0, y: 0 },
  isLoading = false,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef(null);
  const itemRefs = useRef([]);

  // Use refs to store latest callbacks to prevent event listener re-registration
  const onSelectRef = useRef(onSelect);
  const onCloseRef = useRef(onClose);

  // Update refs when callbacks change
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Filter users based on query
  const filteredUsers = users.filter((user) => {
    const displayName = user.displayName || user.email || "";
    const searchText = displayName.toLowerCase();
    const queryLower = query.toLowerCase();
    return searchText.includes(queryLower);
  });

  // Limit results to 8
  const visibleUsers = filteredUsers.slice(0, 8);

  // Reset selected index when filtered users change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex].scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!visibleUsers.length) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < visibleUsers.length - 1 ? prev + 1 : 0
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : visibleUsers.length - 1
          );
          break;

        case "Enter":
          e.preventDefault();
          if (visibleUsers[selectedIndex]) {
            // Use ref to avoid re-registering event listener
            onSelectRef.current(visibleUsers[selectedIndex]);
          }
          break;

        case "Escape":
          e.preventDefault();
          // Use ref to avoid re-registering event listener
          onCloseRef.current();
          break;

        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visibleUsers, selectedIndex]); // Removed onSelect and onClose from dependencies

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        // Use ref to avoid re-registering event listener
        onCloseRef.current();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []); // No dependencies - uses ref for latest callback

  // Don't render if no users or loading
  if (isLoading) {
    return (
      <div
        ref={dropdownRef}
        className="fixed z-[100] w-64 rounded-card border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg p-3"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        <div className="text-sm text-slate-500 dark:text-slate-400 text-center">
          Loading users...
        </div>
      </div>
    );
  }

  if (!visibleUsers.length) {
    return (
      <div
        ref={dropdownRef}
        className="fixed z-[100] w-64 rounded-card border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg p-3"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        <div className="text-sm text-slate-500 dark:text-slate-400 text-center">
          No users found
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dropdownRef}
      className="fixed z-[100] w-72 rounded-card border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxHeight: "320px",
      }}
      role="listbox"
      aria-label="Mention suggestions"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          <User className="h-3.5 w-3.5" />
          <span>Mention user</span>
        </div>
      </div>

      {/* User List */}
      <div className="overflow-y-auto max-h-64">
        {visibleUsers.map((user, index) => {
          const isSelected = index === selectedIndex;
          const displayName = user.displayName || user.email || "Unknown User";

          return (
            <button
              key={user.id}
              ref={(el) => (itemRefs.current[index] = el)}
              type="button"
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${
                isSelected
                  ? "bg-primary/10 dark:bg-primary/20"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
              }`}
              onClick={() => onSelect(user)}
              role="option"
              aria-selected={isSelected}
            >
              {/* Avatar */}
              <Avatar
                src={user.photoURL}
                name={displayName}
                size="sm"
              />

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {displayName}
                </div>
                {user.email && user.displayName && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user.email}
                  </div>
                )}
              </div>

              {/* Selected Indicator */}
              {isSelected && (
                <div className="text-xs text-primary font-medium">Enter</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Hint */}
      <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">↑↓</span> Navigate
          <span className="mx-1">·</span>
          <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">Enter</span> Select
          <span className="mx-1">·</span>
          <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">Esc</span> Close
        </div>
      </div>
    </div>
  );
}
