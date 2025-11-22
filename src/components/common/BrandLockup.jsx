import React from 'react';
import { useTheme } from '../../context/ThemeContext';

/**
 * BrandLockup Component
 *
 * Displays co-branded logos for Immediate and Unbound Merino.
 * Automatically switches logo variants based on the current theme (light/dark).
 *
 * @param {Object} props
 * @param {'sm' | 'md' | 'lg'} props.size - Logo size variant
 * @param {string} props.className - Additional CSS classes
 *
 * @example
 * <BrandLockup size="md" />
 *
 * @see src/styles/design-system.md - Brand Guidelines section
 */
export function BrandLockup({ size = 'md', className = '' }) {
  const { resolvedTheme } = useTheme();

  // Different heights for visual balance
  // Immediate logo is very wide (8.6:1 ratio), Unbound is more square (1.87:1 ratio)
  // Using different heights creates visual balance between the two logos
  // Note: Unbound logo has significant padding in the file, affecting visual spacing
  const immediateHeight = 'h-3.5'; // 14px - compact size for the wide logo
  const unboundHeight = 'h-14'; // 56px - allows more square Unbound logo to match visual weight
  const separatorHeight = 'h-12'; // 48px - closer to Unbound height for more even visual spacing

  // Select appropriate logo variants based on theme
  const immediateLogo = resolvedTheme === 'dark'
    ? '/images/brands/immediate-logo-white.png'
    : '/images/brands/immediate-logo-black.png';

  const unboundLogo = resolvedTheme === 'dark'
    ? '/images/brands/unbound-logo-white.png'
    : '/images/brands/unbound-logo-black.png';

  return (
    <div
      className={`flex items-center shrink-0 gap-3 ${className}`}
      role="img"
      aria-label="Immediate and Unbound Merino"
    >
      {/* Immediate Logo */}
      <img
        src={immediateLogo}
        alt="Immediate"
        className={`${immediateHeight} w-auto object-contain`}
        loading="eager"
        onError={(e) => {
          // Fallback: Hide image if logo not found
          // This prevents broken image icons for missing Immediate logos
          e.target.style.display = 'none';
          console.warn('Immediate logo not found:', immediateLogo);
        }}
      />

      {/* Separator */}
      <div
        className={`${separatorHeight} w-px bg-neutral-300 dark:bg-neutral-600 ml-3.5`}
        aria-hidden="true"
      />

      {/* Unbound Merino Logo */}
      <img
        src={unboundLogo}
        alt="Unbound Merino"
        className={`${unboundHeight} w-auto object-contain`}
        loading="eager"
        onError={(e) => {
          // Fallback: Hide image if logo not found
          // This prevents broken image icons for missing Unbound logos
          e.target.style.display = 'none';
          console.warn('Unbound logo not found:', unboundLogo);
        }}
      />
    </div>
  );
}

export default BrandLockup;
