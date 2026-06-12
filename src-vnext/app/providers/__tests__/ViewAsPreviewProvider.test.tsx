/// <reference types="@testing-library/jest-dom" />
// 5e-III — in-memory View-as preview provider. ZERO PERSISTENCE invariant:
// entering/clearing the preview must NOT write localStorage, URL, or fire a toast.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { ReactNode } from "react"
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
})
