import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes with proper precedence.
 * Uses clsx for conditional classnames and tailwind-merge to handle conflicts.
 *
 * @param {...(string|string[]|Object)} inputs - Class names to merge
 * @returns {string} Merged class names
 *
 * @example
 * // Basic usage
 * cn('px-2 py-1', 'text-red-500')
 * // => 'px-2 py-1 text-red-500'
 *
 * @example
 * // Conditional classes
 * cn('base-class', isActive && 'active-class', isDisabled && 'disabled-class')
 * // => 'base-class active-class' (when isActive=true, isDisabled=false)
 *
 * @example
 * // Object syntax for conditions
 * cn('base-class', {
 *   'active-class': isActive,
 *   'disabled-class': isDisabled
 * })
 *
 * @example
 * // Tailwind conflicts are resolved (last wins)
 * cn('px-2', 'px-4')
 * // => 'px-4' (px-2 is overridden)
 *
 * @example
 * // Common component pattern
 * function Button({ className, variant }) {
 *   return (
 *     <button className={cn(
 *       'px-4 py-2 rounded',
 *       variant === 'primary' && 'bg-blue-500 text-white',
 *       variant === 'secondary' && 'bg-gray-200 text-gray-900',
 *       className
 *     )}>
 *       Click me
 *     </button>
 *   )
 * }
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
