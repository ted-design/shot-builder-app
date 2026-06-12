/// <reference types="@testing-library/jest-dom" />
// 5e-III — in-memory View-as preview provider. ZERO PERSISTENCE invariant:
// entering/clearing the preview must NOT write localStorage, URL, or fire a toast.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { ReactNode } from "react"

// The provider reads useAuth to reset the preview when the signed-in identity
// or global role changes — mock it so tests can simulate a user swap.
const authState = vi.hoisted(() => ({ uid: "u1", role: "admin" }))
vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: authState.uid ? { uid: authState.uid } : null,
    role: authState.role,
  }),
}))

import {
  ViewAsPreviewProvider,
  useViewAsPreview,
} from "@/app/providers/ViewAsPreviewProvider"

function wrapper({ children }: { children: ReactNode }) {
  return <ViewAsPreviewProvider>{children}</ViewAsPreviewProvider>
}

describe("ViewAsPreviewProvider", () => {
  let setItemSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    authState.uid = "u1"
    authState.role = "admin"
    setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem")
  })

  afterEach(() => {
    setItemSpy.mockRestore()
  })

  it("defaults previewRole to null (not previewing)", () => {
    const { result } = renderHook(() => useViewAsPreview(), { wrapper })
    expect(result.current.previewRole).toBeNull()
  })

  it("setPreviewRole('crew') updates the preview role", () => {
    const { result } = renderHook(() => useViewAsPreview(), { wrapper })
    act(() => result.current.setPreviewRole("crew"))
    expect(result.current.previewRole).toBe("crew")
  })

  it("clearPreview resets the preview role to null", () => {
    const { result } = renderHook(() => useViewAsPreview(), { wrapper })
    act(() => result.current.setPreviewRole("crew"))
    expect(result.current.previewRole).toBe("crew")
    act(() => result.current.clearPreview())
    expect(result.current.previewRole).toBeNull()
  })

  it("writes NOTHING to localStorage on enter or clear (zero persistence)", () => {
    const { result } = renderHook(() => useViewAsPreview(), { wrapper })
    act(() => result.current.setPreviewRole("crew"))
    act(() => result.current.clearPreview())
    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it("resets the preview when the signed-in user changes (no stale preview across an in-place sign-in)", () => {
    const { result, rerender } = renderHook(() => useViewAsPreview(), { wrapper })
    act(() => result.current.setPreviewRole("crew"))
    expect(result.current.previewRole).toBe("crew")
    // Simulate an in-place user swap (sign-out → sign-in as a different user).
    act(() => {
      authState.uid = "u2"
      rerender()
    })
    expect(result.current.previewRole).toBeNull()
  })

  it("resets the preview when the global role changes (mid-session claim change)", () => {
    const { result, rerender } = renderHook(() => useViewAsPreview(), { wrapper })
    act(() => result.current.setPreviewRole("crew"))
    expect(result.current.previewRole).toBe("crew")
    act(() => {
      authState.role = "viewer"
      rerender()
    })
    expect(result.current.previewRole).toBeNull()
  })
})
