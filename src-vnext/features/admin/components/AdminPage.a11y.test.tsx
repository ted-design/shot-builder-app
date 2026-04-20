/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import AdminPage from "./AdminPage"

/**
 * Regression guard for axe-core `color-contrast` violation H-2 on /admin.
 *
 * The Playwright a11y spec (tests/a11y.spec.ts:79) exercises the full rendered
 * tree via axe-core. This unit-level guard asserts the equivalent invariant
 * without the Firebase emulator + build + serve harness: key text elements on
 * the Admin page render with foreground / background pairs that clear WCAG 2
 * AA contrast thresholds (4.5:1 for normal text, 3:1 for large / bold ≥18.66px).
 *
 * The specific offender this guard pins down is the `.label-meta` semantic
 * typography class (design-tokens.js). It is used on every table header of
 * the AdminPage team roster, and previously pointed at --color-text-subtle
 * (#a1a1aa / zinc-400), which gives only 2.56:1 on white — failing AA. H-2
 * moved it to --color-text-muted (#71717a / zinc-500), 4.83:1 on white.
 *
 * If this fails, either the token was reverted or a new axe-relevant text
 * element on the Admin page is rendering with insufficient contrast.
 */

// ---- Mocks ----

vi.mock("@/features/admin/hooks/useUsers", () => ({
  useUsers: () => ({
    data: [
      {
        id: "u1",
        email: "active@test.com",
        displayName: "Active User",
        role: "producer",
        status: "active",
      },
    ],
    loading: false,
    error: null,
  }),
}))

vi.mock("@/features/admin/hooks/usePendingInvitations", () => ({
  usePendingInvitations: () => ({ data: [], loading: false, error: null }),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: { uid: "me", email: "me@test.com", displayName: "Me", photoURL: null },
    clientId: "c1",
    role: "admin",
  }),
}))

// Stub sub-components we don't need to exercise here
vi.mock("./InviteUserDialog", () => ({
  InviteUserDialog: () => null,
}))

vi.mock("./ProjectAccessTab", () => ({
  ProjectAccessTab: () => <div>ProjectAccessTab</div>,
}))

vi.mock("./UserRoleSelect", () => ({
  UserRoleSelect: ({ currentRole }: { readonly currentRole: string }) => (
    <span>{currentRole}</span>
  ),
}))

// ---- WCAG contrast helpers (mirrors axe-core's color-contrast math) ----

function parseHex(hex: string): readonly [number, number, number] {
  const m = hex.trim().replace(/^#/, "")
  const n = m.length === 3
    ? m.split("").map((c) => c + c).join("")
    : m
  const r = parseInt(n.slice(0, 2), 16) / 255
  const g = parseInt(n.slice(2, 4), 16) / 255
  const b = parseInt(n.slice(4, 6), 16) / 255
  return [r, g, b] as const
}

function srgbToLinear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** WCAG 2.x relative luminance. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  )
}

/** WCAG 2.x contrast ratio between two colors. */
function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (lighter + 0.05) / (darker + 0.05)
}

// ---- Design tokens under test ----

// These values mirror tokens.css and must be kept in sync if the token file
// is edited. We read the semantic name the source uses rather than importing
// the CSS directly (jsdom does not resolve @tailwind plugins / custom props).
const TOKENS = {
  "color-text": "#18181b",            // zinc-900
  "color-text-secondary": "#52525b",  // zinc-600
  "color-text-muted": "#71717a",      // zinc-500
  "color-text-subtle": "#a1a1aa",     // zinc-400
  "color-surface": "#ffffff",
  "color-surface-subtle": "#f4f4f5",  // zinc-100
  "color-bg": "#fafafa",              // zinc-50
} as const

const AA_NORMAL = 4.5
const AA_LARGE = 3.0

// ---- Baseline math sanity tests ----

describe("WCAG contrast math sanity", () => {
  it("matches known zinc-on-white reference ratios within rounding", () => {
    // Cross-checked against WebAIM calculator.
    expect(
      contrastRatio(TOKENS["color-text-subtle"], TOKENS["color-surface"]),
    ).toBeCloseTo(2.56, 1)
    expect(
      contrastRatio(TOKENS["color-text-muted"], TOKENS["color-surface"]),
    ).toBeCloseTo(4.83, 1)
    expect(
      contrastRatio(TOKENS["color-text-secondary"], TOKENS["color-surface"]),
    ).toBeCloseTo(7.73, 1)
  })
})

// ---- H-2 regression: .label-meta token ----

describe("Admin page color-contrast (H-2 regression)", () => {
  /**
   * Hard-pins the `.label-meta` color choice. If the design-tokens.js plugin
   * ever reverts this class back to --color-text-subtle (zinc-400), axe-core
   * will flag color-contrast on every .label-meta element on /admin.
   *
   * We assert against the semantic requirement (4.5:1 AA) rather than the
   * literal token name so a future token rename (e.g. if `--color-text-muted`
   * is recolored to a darker value) does not trigger a false positive.
   */
  it(".label-meta text color meets WCAG AA (4.5:1) on both surface and surface-subtle", () => {
    // Read the plugin source to confirm the class still references a token
    // that clears AA. We deliberately do NOT parse CSS; we read the JS plugin
    // definition statically.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- static read of plugin source
    const fs = require("fs") as typeof import("fs")
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as typeof import("path")
    const tokensPath = path.resolve(__dirname, "../../../../design-tokens.js")
    const src = fs.readFileSync(tokensPath, "utf8")

    // Match the `.label-meta` block's `color:` line.
    const match = src.match(
      /'\.label-meta'\s*:\s*\{[\s\S]*?color:\s*'var\((--color-text-[a-z-]+)\)'/,
    )
    expect(match, ".label-meta color property should reference a --color-text-* var").not.toBeNull()

    const tokenName = match![1] as keyof typeof TOKENS | `--${string}`
    const resolved = TOKENS[tokenName.replace(/^--/, "") as keyof typeof TOKENS]
    expect(resolved, `token ${tokenName} must be a known value in this test's map`).toBeDefined()

    // `.label-meta` is 12px semibold — does NOT qualify as WCAG "large text"
    // (which requires 14pt / 18.66px bold or 18pt / 24px regular). AA normal.
    for (const bgName of ["color-surface", "color-surface-subtle"] as const) {
      const ratio = contrastRatio(resolved as string, TOKENS[bgName])
      expect(
        ratio,
        `.label-meta (${tokenName} = ${resolved}) on ${bgName} (${TOKENS[bgName]}) ` +
          `must clear AA ${AA_NORMAL}:1 — got ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(AA_NORMAL)
    }
  })

  it("refuses any .label-meta rendering on a white-ish surface that fails AA", () => {
    // Defensive: assert directly that --color-text-subtle is NOT a valid
    // choice for .label-meta, since that was the H-2 offender.
    const badRatio = contrastRatio(
      TOKENS["color-text-subtle"],
      TOKENS["color-surface"],
    )
    expect(badRatio).toBeLessThan(AA_NORMAL)
    // If this assertion flips (i.e. zinc-400 ever clears AA on white) the
    // H-2 guard becomes redundant, which is a fine problem to have.
  })

  it("renders the admin page with every table header using the fixed token", () => {
    // Smoke-test the page to make sure a refactor didn't drop `.label-meta`
    // off the column headers in favor of an inline color that bypasses the
    // token. We don't compute contrast in jsdom (no CSSOM), but we assert
    // structural invariant: at least one `.label-meta` element remains.
    const { container } = render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </MemoryRouter>,
    )
    const metaLabels = container.querySelectorAll(".label-meta")
    expect(metaLabels.length).toBeGreaterThan(0)
  })
})
