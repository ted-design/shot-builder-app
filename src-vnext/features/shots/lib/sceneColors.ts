/**
 * Scene color palette — the 6 accent colors users can assign to scenes.
 * Extracted from SceneHeader.tsx so non-component code (column renderers,
 * numbering dialogs, etc.) can resolve colors without pulling in a component
 * file.
 */

export const SCENE_COLORS = [
  { key: "teal", hex: "#14b8a6" },
  { key: "purple", hex: "#a78bfa" },
  { key: "green", hex: "#22c55e" },
  { key: "orange", hex: "#fb923c" },
  { key: "pink", hex: "#fb7185" },
  { key: "blue", hex: "#3b82f6" },
] as const

export type SceneColorKey = (typeof SCENE_COLORS)[number]["key"]

/**
 * Resolves a scene color key to a CSS color value.
 * Returns a subtle fallback when no color is set, or the raw value if the key
 * isn't recognized (future-proofs against legacy colors stored in Firestore).
 */
export function getSceneColor(color?: string | null): string {
  if (!color) return "var(--color-text-subtle)"
  const found = SCENE_COLORS.find((c) => c.key === color)
  return found?.hex ?? color
}
