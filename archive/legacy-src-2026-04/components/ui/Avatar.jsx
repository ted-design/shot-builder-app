/**
 * Avatar - User avatar component with initials fallback
 * Displays user photo or colored initials
 */

import React, { useMemo, useState } from 'react';

/**
 * Get initials from name or email
 */
function getInitials(name, email) {
  if (name && typeof name === 'string') {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      // First and last name
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length > 0) {
      // Single name
      return parts[0].slice(0, 2).toUpperCase();
    }
  }

  if (email && typeof email === 'string') {
    const emailPart = email.split('@')[0];
    return emailPart.slice(0, 2).toUpperCase();
  }

  return 'U';
}

/**
 * Generate consistent color from string
 */
function stringToColor(str) {
  if (!str) return 'bg-slate-500 dark:bg-slate-600';

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    'bg-blue-500 dark:bg-blue-600',
    'bg-green-500 dark:bg-green-600',
    'bg-purple-500 dark:bg-purple-600',
    'bg-pink-500 dark:bg-pink-600',
    'bg-indigo-500 dark:bg-indigo-600',
    'bg-teal-500 dark:bg-teal-600',
    'bg-orange-500 dark:bg-orange-600',
    'bg-cyan-500 dark:bg-cyan-600',
  ];

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Avatar sizes
 */
const sizeClasses = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
};

/**
 * Avatar component
 */
export default function Avatar({
  name,
  email,
  photoUrl,
  size = 'md',
  className = ''
}) {
  const [imageError, setImageError] = useState(false);
  const initials = useMemo(() => getInitials(name, email), [name, email]);
  const colorClass = useMemo(() => stringToColor(name || email), [name, email]);
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  const baseClasses = `inline-flex items-center justify-center rounded-full font-semibold text-white ${sizeClass} ${className}`;

  // Show initials if no photoUrl OR if image failed to load
  if (!photoUrl || imageError) {
    return (
      <div
        className={`${baseClasses} ${colorClass}`}
        aria-label={`Avatar for ${name || email || 'user'}`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={name || email || 'User avatar'}
      className={`${baseClasses} object-cover`}
      onError={() => setImageError(true)}
    />
  );
}
