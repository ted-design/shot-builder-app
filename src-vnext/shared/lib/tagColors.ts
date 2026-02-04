const TAG_COLOR_CLASS_MAP = {
  red: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  orange:
    "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  amber:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  yellow:
    "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  green:
    "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  emerald:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  blue: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  indigo:
    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800",
  purple:
    "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  pink: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800",
  gray: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
} as const

export type TagColorKey = keyof typeof TAG_COLOR_CLASS_MAP

export const TAG_COLOR_KEYS = Object.keys(TAG_COLOR_CLASS_MAP) as TagColorKey[]

export function isTagColorKey(value: unknown): value is TagColorKey {
  return typeof value === "string" && value in TAG_COLOR_CLASS_MAP
}

export function getTagColorClasses(color: unknown): string {
  if (isTagColorKey(color)) return TAG_COLOR_CLASS_MAP[color]
  return TAG_COLOR_CLASS_MAP.gray
}

export function getTagSwatchClasses(color: unknown): string {
  const baseClasses = getTagColorClasses(color)
  const allowPrefixes = ["bg-", "dark:bg-", "border-", "dark:border-"]
  return baseClasses
    .split(" ")
    .filter((utility) => allowPrefixes.some((prefix) => utility.startsWith(prefix)))
    .join(" ")
}

