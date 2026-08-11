import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"

// Source-vector guard for the 2026-08-11 status-vocabulary consolidation:
// statusMappings.ts (SHOT_STATUS_MAP) is the ONLY place a shot-status label
// may be spelled out. Every consumer must import/derive from it instead of
// carrying its own literal todo/in_progress/on_hold/complete → label map.
//
// Detection: an object-literal entry `todo: "Draft"` (key immediately
// followed by a colon and a quoted string) whose string, once lowercased,
// is one of the label words that have appeared across the FOUR vocabularies
// this PR unified (canonical + the two "legacy"/report label sets). Requires
// the key to be an EXACT shot-status token — "todo" | "in_progress" |
// "on_hold" | "complete" — so unrelated domains sharing a token (pull status
// "draft", asset-requirement-flag "in_progress", casting-board "hold") never
// match: none of them use ALL FOUR shot-status keys together.
//
// A canonical accessor call — `todo: { label: getShotStatusLabel("todo") }`
// or `getShotStatusColor(s)` — does NOT match: the character right after the
// key's colon is `{` or an identifier, never a quote, so nothing here
// penalizes the correct "call into statusMappings.ts" pattern.
//
// Known blind spot (documented, not silently assumed away): this only
// catches the "key: literal-string" object shape. A switch/case or ternary
// that maps each status to a label string via `case "todo": return "Draft"`
// would not match. No such shape exists for shot status anywhere in
// src-vnext today (verified by grep during this PR) — if one is introduced,
// extend this detector rather than trust the gap stays empty.

const REPO_ROOT = resolve(import.meta.dirname, "../../..")
const SRC_ROOT = join(REPO_ROOT, "src-vnext")
const CANONICAL_FILE = join(SRC_ROOT, "shared/lib/statusMappings.ts")

const SHOT_STATUS_KEYS = ["todo", "in_progress", "on_hold", "complete"] as const

// Label words seen across the canonical vocabulary AND the two now-deleted
// "legacy"/report-only label sets this PR unified. Matching on the WORD
// (not the exact casing/dialect) means the guard doesn't care which of the
// four historical spellings comes back — any of them reintroduces drift.
const LABEL_WORDS = new Set([
  "draft",
  "to do",
  "to-do",
  "in progress",
  "on hold",
  "shot",
  "complete",
])

function stripComments(src: string): string {
  // Block comments first, then line comments — matches the convention used
  // elsewhere in this repo's source-vector guards (see testing-discipline.md
  // "a source-text vector matches COMMENTS"). Order matters: stripping line
  // comments first would leave a dangling "/*" if a "//" appeared inside a
  // block comment's own line.
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, "")
  return noBlock.replace(/(^|[^:])\/\/.*$/gm, "$1")
}

/** Does `content` contain >=3 of the 4 shot-status keys mapped directly to a
 *  literal string that reads as one of the known label words? Returns the
 *  matched keys for a useful failure message. */
function findHardcodedLabelKeys(content: string): string[] {
  const stripped = stripComments(content)
  const found: string[] = []
  for (const key of SHOT_STATUS_KEYS) {
    const pattern = new RegExp(`\\b${key}\\s*:\\s*(["'\`])((?:(?!\\1).)*)\\1`, "g")
    for (const m of stripped.matchAll(pattern)) {
      const value = (m[2] ?? "").trim().toLowerCase()
      if (LABEL_WORDS.has(value)) {
        found.push(key)
        break
      }
    }
  }
  return found
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const info = statSync(full)
    if (info.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue
      out.push(...listSourceFiles(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.test\.tsx?$/.test(entry)) continue
    out.push(full)
  }
  return out
}

describe("shot-status vocabulary — single source of truth", () => {
  it("no file outside statusMappings.ts hardcodes a todo/in_progress/on_hold/complete label map", () => {
    const offenders: Array<{ readonly file: string; readonly keys: readonly string[] }> = []
    for (const file of listSourceFiles(SRC_ROOT)) {
      if (file === CANONICAL_FILE) continue
      const content = readFileSync(file, "utf8")
      const keys = findHardcodedLabelKeys(content)
      if (keys.length >= 3) {
        offenders.push({ file: relative(REPO_ROOT, file), keys })
      }
    }

    if (offenders.length > 0) {
      const detail = offenders
        .map((o) => `  ${o.file} (matched: ${o.keys.join(", ")})`)
        .join("\n")
      throw new Error(
        `Found a local shot-status label map outside statusMappings.ts:\n${detail}\n` +
          `Import/derive from @/shared/lib/statusMappings instead (SHOT_STATUS_MAP, ` +
          `SHOT_STATUS_CYCLE, getShotStatusLabel/Color/Mapping).`,
      )
    }
    expect(offenders).toEqual([])
  })

  // Positive control: a sweep that finds "no offenders" because the canonical
  // module itself was gutted (or every consumer was deleted) is not a pass.
  // Assert the source of truth still carries the real vocabulary...
  it("statusMappings.ts still defines the canonical SHOT_STATUS_MAP labels", () => {
    const content = readFileSync(CANONICAL_FILE, "utf8")
    expect(content).toContain('label: "Draft"')
    expect(content).toContain('label: "In Progress"')
    expect(content).toContain('label: "Shot"')
    expect(content).toContain('label: "On Hold"')
  })

  // ...and that the deduped consumer files still actually import from it,
  // rather than having quietly deleted their status-handling code to dodge
  // the sweep above.
  it("every deduped consumer still imports the canonical module", () => {
    const mustImport = [
      "features/shots/lib/shotListFilters.ts",
      "features/shots/components/ShotStatusFilter.tsx",
      "features/shots/components/ShotListFilterContent.tsx",
      "features/shots/lib/mapShot.ts",
      "features/export/lib/report/reportTypes.ts",
      "features/export/lib/report/reportPdfShared.ts",
      "features/export/components/report/reportShared.ts",
      "features/export/lib/report/reportModel.ts",
    ]
    for (const rel of mustImport) {
      const content = readFileSync(join(SRC_ROOT, rel), "utf8")
      expect(content, `${rel} should import from @/shared/lib/statusMappings`).toContain(
        "@/shared/lib/statusMappings",
      )
    }
  })
})
