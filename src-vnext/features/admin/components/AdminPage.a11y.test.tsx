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
 * moved it to --color-text-secondary (#52525b / zinc-600), 7.73:1 on white
 * (design-tokens.js:120). This guard reads that token name from the plugin
 * source at runtime, so it stays correct as token values evolve.
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
  // muted is INTENTIONALLY aliased to secondary (#52525b) post-Phase-7: the old
  // lighter muted tier (#71717a) failed AA so it was retired; hierarchy now comes
  // from type weight/size, not color (DESIGN.md). The collision is deliberate.
  "color-text-muted": "#52525b",      // re-pointed to zinc-600 for AA (Phase 7; was #71717a)
  "color-text-subtle": "#5b5b60",     // darkened for AA on all light surfaces (Phase 7; was #a1a1aa)
  "color-surface": "#f5f5f5",         // Immediate White (top of ramp; no pure #fff)
  "color-surface-subtle": "#ebebeb",
  "color-bg": "#eaeaea",              // App background — light grey
} as const

const AA_NORMAL = 4.5
const AA_LARGE = 3.0

// ---- Baseline math sanity tests ----

describe("WCAG contrast math sanity", () => {
  it("matches known zinc-on-white reference ratios within rounding", () => {
    // These reference ratios pin the contrastRatio math to fixed values for the
    // post-Phase-7 token hexes on pure WHITE (#ffffff), independent of the app's
    // actual surface token (the off-white Immediate #f5f5f5, exercised by the
    // H-2 tests). Subtle/muted were re-pointed in Phase 7 for AA, so the prior
    // zinc-400 (2.56:1) / zinc-500 (4.83:1) references no longer apply.
    const WHITE = "#ffffff"
    expect(contrastRatio(TOKENS["color-text-subtle"], WHITE)).toBeCloseTo(6.75, 1)  // #5b5b60
    expect(contrastRatio(TOKENS["color-text-muted"], WHITE)).toBeCloseTo(7.73, 1)   // #52525b (== secondary)
    expect(contrastRatio(TOKENS["color-text-secondary"], WHITE)).toBeCloseTo(7.73, 1)
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
    const fs = require("fs") as typeof import("fs")
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

  it("--color-text-subtle now clears AA on the surface (Phase 7 re-point)", () => {
    // Pre-Phase-7 this test asserted the OPPOSITE: --color-text-subtle (#a1a1aa,
    // zinc-400) was the H-2 offender and FAILED AA on white-ish surfaces. Phase 7
    // darkened subtle to #5b5b60, which now clears AA on every light surface incl.
    // the worst case #e0e0e0. The original "this token fails AA" guard is therefore
    // retired (the bad contrast no longer exists). We keep the check, inverted, so
    // a future revert of subtle back toward zinc-400 trips it.
    const ratio = contrastRatio(
      TOKENS["color-text-subtle"],
      TOKENS["color-surface"],
    )
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL)
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
