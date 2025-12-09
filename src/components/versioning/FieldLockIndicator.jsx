import React from "react";
import { Lock, User } from "lucide-react";

/**
 * FieldLockIndicator - Shows when another user is editing a field
 *
 * Displays a small indicator with the editor's avatar and a pulsing animation
 * to indicate real-time collaborative editing.
 *
 * @param {Object} props
 * @param {boolean} props.isLocked - Whether the field is locked
 * @param {Object} props.lockedBy - Who has the lock
 * @param {string} props.lockedBy.userName - Editor's name
 * @param {string} props.lockedBy.userAvatar - Editor's avatar URL
 * @param {string} props.size - Size variant: "sm" | "md" (default: "sm")
 * @param {string} props.position - Position relative to parent: "left" | "right" (default: "right")
 */
export default function FieldLockIndicator({
  isLocked,
  lockedBy,
  size = "sm",
  position = "right",
}) {
  if (!isLocked || !lockedBy) {
    return null;
  }

  const sizeClasses = {
    sm: {
      container: "h-5 gap-1 px-1.5 text-xs",
      avatar: "h-4 w-4",
      icon: "h-3 w-3",
    },
    md: {
      container: "h-6 gap-1.5 px-2 text-sm",
      avatar: "h-5 w-5",
      icon: "h-3.5 w-3.5",
    },
  };

  const classes = sizeClasses[size] || sizeClasses.sm;

  const positionClasses = {
    left: "left-0",
    right: "right-0",
  };

  return (
    <div
      className={`
        absolute top-0 ${positionClasses[position]}
        inline-flex items-center ${classes.container}
        bg-amber-50 dark:bg-amber-900/30
        border border-amber-200 dark:border-amber-700
        rounded-full
        text-amber-700 dark:text-amber-300
        animate-pulse
        z-10
      `}
      title={`${lockedBy.userName} is editing this field`}
    >
      {/* Avatar or lock icon */}
      {lockedBy.userAvatar ? (
        <img
          src={lockedBy.userAvatar}
          alt={lockedBy.userName}
          className={`${classes.avatar} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${classes.avatar} rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center`}
        >
          <User className={`${classes.icon} text-amber-600 dark:text-amber-400`} />
        </div>
      )}

      {/* Editing text */}
      <span className="whitespace-nowrap font-medium">Editing...</span>
    </div>
  );
}

/**
 * FieldLockWrapper - Wrapper component that adds lock indicator to a field
 *
 * Wraps a form field and displays a lock indicator when the field is locked.
 * Also adds a visual border treatment to indicate locked state.
 *
 * @param {Object} props
 * @param {boolean} props.isLocked - Whether the field is locked
 * @param {Object} props.lockedBy - Who has the lock
 * @param {React.ReactNode} props.children - The form field to wrap
 * @param {string} props.className - Additional class names
 */
export function FieldLockWrapper({
  isLocked,
  lockedBy,
  children,
  className = "",
}) {
  return (
    <div className={`relative ${className}`}>
      {/* Lock indicator */}
      <FieldLockIndicator isLocked={isLocked} lockedBy={lockedBy} />

      {/* Field content with locked styling */}
      <div
        className={`
          transition-all duration-200
          ${
            isLocked
              ? "opacity-70 pointer-events-none ring-2 ring-amber-300 dark:ring-amber-600 rounded-md"
              : ""
          }
        `}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * InlineLockIndicator - Compact inline lock indicator
 *
 * A more compact version for use in tight spaces like table cells.
 *
 * @param {Object} props
 * @param {boolean} props.isLocked - Whether the field is locked
 * @param {Object} props.lockedBy - Who has the lock
 */
export function InlineLockIndicator({ isLocked, lockedBy }) {
  if (!isLocked || !lockedBy) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
      title={`${lockedBy.userName} is editing`}
    >
      <Lock className="h-3 w-3 animate-pulse" />
      {lockedBy.userAvatar && (
        <img
          src={lockedBy.userAvatar}
          alt={lockedBy.userName}
          className="h-4 w-4 rounded-full object-cover"
        />
      )}
    </span>
  );
}
