import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSidebarState } from "./useSidebarState"

describe("useSidebarState", () => {
  it("starts expanded by default", () => {
    const { result } = renderHook(() => useSidebarState())
    expect(result.current.collapsed).toBe(false)
  })

  it("starts collapsed when initialCollapsed is true", () => {
    const { result } = renderHook(() => useSidebarState(true))
    expect(result.current.collapsed).toBe(true)
  })

  it("toggles collapsed state", () => {
    const { result } = renderHook(() => useSidebarState())
    expect(result.current.collapsed).toBe(false)

    act(() => result.current.toggle())
    expect(result.current.collapsed).toBe(true)

    act(() => result.current.toggle())
    expect(result.current.collapsed).toBe(false)
  })

  it("toggles on [ keydown", () => {
    const { result } = renderHook(() => useSidebarState())
    expect(result.current.collapsed).toBe(false)

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "[", bubbles: true }),
      )
    })
    expect(result.current.collapsed).toBe(true)
  })

  it("ignores [ key when target is an input", () => {
    const { result } = renderHook(() => useSidebarState())

    const input = document.createElement("input")
    document.body.appendChild(input)

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "[", bubbles: true }),
      )
    })
    expect(result.current.collapsed).toBe(false)

    document.body.removeChild(input)
  })

  it("ignores [ key when target is a textarea", () => {
    const { result } = renderHook(() => useSidebarState())

    const textarea = document.createElement("textarea")
    document.body.appendChild(textarea)

    act(() => {
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "[", bubbles: true }),
      )
    })
    expect(result.current.collapsed).toBe(false)

    document.body.removeChild(textarea)
  })

  it("ignores non-[ keys", () => {
    const { result } = renderHook(() => useSidebarState())

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "]", bubbles: true }),
      )
    })
    expect(result.current.collapsed).toBe(false)
  })

  it("cleans up event listener on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener")
    const { unmount } = renderHook(() => useSidebarState())
    unmount()
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function))
    removeSpy.mockRestore()
  })
})
