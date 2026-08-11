import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { getShotStatusLabel } from "./statusMappings"

// Source-vector guard for the 2026-08-11 status-vocabulary consolidation:
// statusMappings.ts (SHOT_STATUS_MAP) is the ONLY place a shot-status label
// may be spelled out. Every consumer must import/derive from it instead of
// carrying its own literal todo/in_progress/on_hold/complete → label map.
//
// Detection runs THREE shapes (each independently, results unioned per key):
//
//   1. Flat:   `todo: "Draft"`               — key immediately followed by a
//              colon and a quoted string. Word must be a known label word,
//              OR the match sits inside a `const *LABEL* = { … }` / `const
//              *Label* = { … }` declaration (name-based: catches a flat map
//              that uses BRAND-NEW wording, not just the four historical
//              dialects — see "known blind spots" below for what this still
//              can't catch).
//   2. Nested: `todo: { …, label: "Draft" }` — the deleted STATUS_LEGACY
//              shape (`{ color, label }` per status). Bounded to one level
//              of nesting (`[^{}]*`); every real offender in this codebase
//              nests exactly one level.
//   3. Tuple:  `{ key: "todo", label: "Draft", … }` — the ledgerData.ts
//              LedgerSegment shape (key/label as sibling properties of a
//              non-nested object, either order). Scanned across the whole
//              file, not tied to any declaration name, since these objects
//              are usually array elements, not named consts.
//
// Requires the key to be an EXACT shot-status token — "todo" | "in_progress"
// | "on_hold" | "complete" — so unrelated domains sharing a token (pull
// status "draft", asset-requirement-flag "in_progress", casting-board
// "hold") never match: none of them use ALL FOUR shot-status keys together.
//
// A canonical accessor call — `todo: { label: getShotStatusLabel("todo") }`
// or `getShotStatusColor(s)` — does NOT match any of the three shapes: the
// character right after `label:` (or the flat key's colon) is an identifier
// or a function call, never a quote, so nothing here penalizes the correct
// "call into statusMappings.ts" pattern. Verified against every real
// canonical-accessor site in this codebase (reportPdfShared.ts STATUS,
// ShotListFilterContent.tsx STATUS_OPTIONS) — zero false positives.
//
// Known blind spots (documented, not silently assumed away):
//   - A switch/case or ternary (`case "todo": return "Draft"`) matches none
//     of the three shapes. No such shape exists for shot status anywhere in
//     src-vnext today (verified by grep) — if one is introduced, extend this
//     detector rather than trust the gap stays empty.
//   - A brand-new-wording flat map whose declaration name does NOT contain
//     "label" (e.g. `const REPORT_X = { todo: "Not started", … }`) escapes
//     pass 1 entirely — the name heuristic is the only thing that widens
//     pass 1 past the closed LABEL_WORDS set, and it only fires on a name
//     match. The nested/tuple passes always require the recreated wording
//     to be one of the known LABEL_WORDS too.
//   - A map with only 2 of the 4 keys spelled out (`{ todo: "Draft",
//     complete: "Shot" }`) is below the `keys.length >= 3` offender
//     threshold and escapes on purpose — raising the threshold to 2 risks
//     flagging small, unrelated 2-key literals that happen to share two
//     shot-status tokens.

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

interface DeclSpan {
  readonly name: string
  readonly start: number
  readonly end: number
}

/** Find `const NAME ... = { ... }` declarations and return the brace-balanced
 *  span of each object literal's body (start = index of `{`, end = index
 *  just past the matching `}`). Used only to test whether a match falls
 *  inside a *_LABEL-named declaration (pass 1's name heuristic). */
function findNamedObjectDeclarations(content: string): DeclSpan[] {
  const out: DeclSpan[] = []
  const declRe = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::[^=]+)?=\s*\{/g
  let m: RegExpExecArray | null
  while ((m = declRe.exec(content))) {
    // Capture group 1 is mandatory in declRe (`[A-Za-z_$][A-Za-z0-9_$]*`),
    // so it's always populated when the overall pattern matches — the `?? ""`
    // is only to satisfy noUncheckedIndexedAccess, never actually taken.
    const name = m[1] ?? ""
    const braceStart = declRe.lastIndex - 1
    let depth = 0
    let i = braceStart
    for (; i < content.length; i++) {
      if (content[i] === "{") depth++
      else if (content[i] === "}") {
        depth--
        if (depth === 0) {
          i++
          break
        }
      }
    }
    out.push({ name, start: braceStart, end: i })
    declRe.lastIndex = i
  }
  return out
}

/** Does `content` contain >=3 of the 4 shot-status keys hardcoded to a label,
 *  in any of the flat / nested / tuple shapes described above? Returns the
 *  matched keys (deduped) for a useful failure message. */
function findHardcodedLabelKeys(content: string): string[] {
  const stripped = stripComments(content)
  const found = new Set<string>()
  const labelNamedSpans = findNamedObjectDeclarations(stripped).filter((d) => /label/i.test(d.name))

  // Pass 1: flat `key: "word"`.
  for (const key of SHOT_STATUS_KEYS) {
    const pattern = new RegExp(`\\b${key}\\s*:\\s*(["'\`])((?:(?!\\1).)*)\\1`, "g")
    for (const m of stripped.matchAll(pattern)) {
      const value = (m[2] ?? "").trim().toLowerCase()
      const insideLabelDecl = labelNamedSpans.some((d) => m.index >= d.start && m.index < d.end)
      if (LABEL_WORDS.has(value) || insideLabelDecl) {
        found.add(key)
        break
      }
    }
  }

  // Pass 2: nested `key: { …, label: "word" }` (e.g. the deleted
  // STATUS_LEGACY shape).
  for (const key of SHOT_STATUS_KEYS) {
    const pattern = new RegExp(`\\b${key}\\s*:\\s*\\{([^{}]*)\\}`, "g")
    for (const m of stripped.matchAll(pattern)) {
      const inner = m[1] ?? ""
      const labelMatch = inner.match(/\blabel\s*:\s*(["'`])((?:(?!\1).)*)\1/)
      if (!labelMatch) continue
      const value = (labelMatch[2] ?? "").trim().toLowerCase()
      if (LABEL_WORDS.has(value)) found.add(key)
    }
  }

  // Pass 3: tuple/array-entry `{ key: "in_progress", …, label: "word" }`
  // (ledgerData.ts's LedgerSegment shape).
  const tuplePattern = /\{([^{}]*)\}/g
  for (const m of stripped.matchAll(tuplePattern)) {
    const inner = m[1] ?? ""
    const keyMatch = inner.match(/\bkey\s*:\s*(["'`])((?:(?!\1).)*)\1/)
    if (!keyMatch) continue
    // Capture group 2 is mandatory given keyMatch matched at all — `?? ""`
    // only satisfies noUncheckedIndexedAccess.
    const keyValue = keyMatch[2] ?? ""
    if (!(SHOT_STATUS_KEYS as readonly string[]).includes(keyValue)) continue
    const labelMatch = inner.match(/\blabel\s*:\s*(["'`])((?:(?!\1).)*)\1/)
    if (!labelMatch) continue
    const value = (labelMatch[2] ?? "").trim().toLowerCase()
    if (LABEL_WORDS.has(value)) found.add(keyValue)
  }

  return [...found]
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
  // Assert the source of truth still carries the real vocabulary — through
  // the real accessor, not a whole-file `toContain`. A `toContain` check
  // is satisfiable by an UNRELATED map in the same file (PULL_STATUS_MAP
  // also has `label: "Draft"` and `label: "In Progress"` entries), so it
  // can't actually prove SHOT_STATUS_MAP itself is intact.
  it("statusMappings.ts still defines the canonical SHOT_STATUS_MAP labels", () => {
    expect(getShotStatusLabel("todo")).toBe("Draft")
    expect(getShotStatusLabel("in_progress")).toBe("In Progress")
    expect(getShotStatusLabel("complete")).toBe("Shot")
    expect(getShotStatusLabel("on_hold")).toBe("On Hold")
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
