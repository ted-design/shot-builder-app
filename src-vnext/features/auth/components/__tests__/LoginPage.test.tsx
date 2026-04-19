/// <reference types="@testing-library/jest-dom" />
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

// ---- Mocks ----

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
}))

vi.mock("@/shared/lib/firebase", () => ({
  auth: {},
  provider: {},
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ user: null, loading: false })),
}))

// ---- Tests ----

// Helper: vite marks import.meta.env fields as read-only in the type system,
// but at runtime they're plain object properties. Cast through unknown.
function setEmulatorFlag(value: string): void {
  const env = import.meta.env as unknown as Record<string, string>
  env.VITE_USE_FIREBASE_EMULATORS = value
}

async function loadLoginPage() {
  // Load fresh so import.meta.env.VITE_USE_FIREBASE_EMULATORS is re-read
  // via vi.resetModules() in each test.
  const mod = await import("../LoginPage")
  return mod.default
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.resetModules()
    // Default: emulator flag OFF
    setEmulatorFlag("")
  })

  it("hides the emulator sign-in form by default", async () => {
    setEmulatorFlag("")
    const LoginPage = await loadLoginPage()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(screen.queryByTestId("emulator-login-form")).not.toBeInTheDocument()
    // The Google sign-in button remains.
    expect(screen.getByRole("button", { name: /sign in with google/i })).toBeInTheDocument()
  })

  it("renders the emulator sign-in form when VITE_USE_FIREBASE_EMULATORS=1", async () => {
    setEmulatorFlag("1")
    const LoginPage = await loadLoginPage()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(screen.getByTestId("emulator-login-form")).toBeInTheDocument()
    // Both email and password inputs should be visible.
    const form = screen.getByTestId("emulator-login-form")
    expect(form.querySelector('input[type="email"]')).toBeTruthy()
    expect(form.querySelector('input[type="password"]')).toBeTruthy()
  })

  it("does NOT render the emulator form when flag is 'false'", async () => {
    setEmulatorFlag("false")
    const LoginPage = await loadLoginPage()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(screen.queryByTestId("emulator-login-form")).not.toBeInTheDocument()
  })
})
