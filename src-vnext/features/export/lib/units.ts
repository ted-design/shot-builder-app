// Shared unit conversions for px-canonical block specs.

/** CSS px -> PDF points (1px = 1/96in, 1pt = 1/72in). */
export const pxToPt = (px: number): number => (px * 72) / 96
