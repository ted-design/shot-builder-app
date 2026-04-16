/**
 * Animation utilities for Shot Builder app
 * Phase 9: Animations & Transitions
 *
 * Provides reusable animation patterns and Tailwind classes
 * for consistent, performant animations throughout the app.
 */

/**
 * Tailwind animation classes for common patterns
 * Uses Tailwind's built-in animate-in utilities (requires tailwindcss-animate plugin or manual config)
 */
export const animationClasses = {
  // Card entrance animations
  fadeIn: 'animate-in fade-in duration-200',
  fadeInUp: 'animate-in fade-in slide-in-from-bottom-4 duration-300',

  // Panel and modal animations
  slideInFromRight: 'animate-in slide-in-from-right-2 fade-in duration-200',
  slideInFromTop: 'animate-in slide-in-from-top-4 fade-in duration-200',
  scaleIn: 'animate-in zoom-in-95 fade-in duration-200',

  // Exit animations
  fadeOut: 'animate-out fade-out duration-150',
  slideOutToRight: 'animate-out slide-out-to-right-2 fade-out duration-150',
};

/**
 * Standard animation timing values (in milliseconds)
 */
export const timing = {
  fast: 100,
  normal: 200,
  slow: 300,
  stagger: 50, // Delay between staggered items
};

/**
 * Easing functions for custom animations
 */
export const easing = {
  easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
};

/**
 * Helper to generate staggered animation delay
 * @param {number} index - Item index in list
 * @param {number} delay - Base delay per item (default: 50ms)
 * @returns {Object} Style object with animationDelay
 */
export const getStaggerDelay = (index, delay = timing.stagger) => ({
  animationDelay: `${index * delay}ms`,
  animationFillMode: 'both', // Apply first keyframe before start, keep final state after end
});

/**
 * CSS class names for button interactions
 */
export const buttonAnimations = {
  // Active press state (scales down slightly)
  activePress: 'active:scale-95 transition-transform duration-100',

  // Hover lift (for secondary/ghost buttons)
  hoverLift: 'hover:-translate-y-0.5 transition-all duration-150',

  // Combined press and hover
  interactive: 'active:scale-95 hover:-translate-y-0.5 transition-all duration-150',
};

/**
 * Modal/dialog animation classes
 */
export const modalAnimations = {
  backdrop: 'animate-in fade-in duration-200',
  content: 'animate-in zoom-in-95 slide-in-from-top-8 duration-300',
  exit: 'animate-out fade-out zoom-out-95 duration-200',
};

/**
 * Filter panel animation classes
 */
export const filterPanelAnimations = {
  enter: 'animate-in slide-in-from-right-2 fade-in duration-200',
  exit: 'animate-out slide-out-to-right-2 fade-out duration-150',
};

/**
 * Toast notification animations
 */
export const toastAnimations = {
  enter: 'animate-in slide-in-from-top-4 fade-in duration-300',
  exit: 'animate-out slide-out-to-top-4 fade-out duration-200',
};

/**
 * Utility to check if user prefers reduced motion
 * @returns {boolean} True if user prefers reduced motion
 */
export const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Higher-order function to conditionally apply animations
 * Returns className only if user doesn't prefer reduced motion
 * @param {string} className - Animation class to apply
 * @returns {string} Class name or empty string
 */
export const withMotion = (className) => {
  return prefersReducedMotion() ? '' : className;
};

/**
 * Get Tailwind classes for motion-safe animations
 * Automatically adds motion-safe: and motion-reduce: variants
 * @param {string} animationClass - Base animation class
 * @returns {string} Motion-aware class names
 */
export const motionSafe = (animationClass) => {
  return `motion-safe:${animationClass} motion-reduce:animate-none`;
};
