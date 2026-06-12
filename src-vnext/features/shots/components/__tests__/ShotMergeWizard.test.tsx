/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"
import type {
  ShotMergeMode,
  ShotMergeResult,
} from "@/features/shots/lib/shotMergeWrites"

// --- Mocks (hoisted handles) ---
const mockNavigate = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  )
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: () => undefined,
}))

const buildShotMergePlanMock = vi.fn()
const executeShotMergeMock = vi.fn()
vi.mock("@/features/shots/lib/shotMergeWrites", () => ({
  buildShotMergePlan: (args: unknown) => buildShotMergePlanMock(args),
  executeShotMerge: (args: unknown) => executeShotMergeMock(args),
}))

const toastError = vi.fn()
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a) },
}))

import { ShotMergeWizard } from "@/features/shots/components/ShotMergeWizard"

function makeShot(overrides: Partial<Shot>): Shot {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Shot",
    projectId: overrides.projectId ?? "p1",
    clientId: overrides.clientId ?? "c1",
    status: overrides.status ?? "todo",
    talent: overrides.talent ?? [],
    talentIds: overrides.talentIds,
    products: overrides.products ?? [],
    locationId: overrides.locationId,
    locationName: overrides.locationName,
    laneId: overrides.laneId,
    sortOrder: overrides.sortOrder ?? 0,
    shotNumber: overrides.shotNumber,
    notes: overrides.notes,
    notesAddendum: overrides.notesAddendum,
    referenceLinks: overrides.referenceLinks,
    looks: overrides.looks,
    activeLookId: overrides.activeLookId,
    date: overrides.date,
    heroImage: overrides.heroImage,
    tags: overrides.tags,
    deleted: overrides.deleted,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    createdBy: overrides.createdBy ?? "u1",
  }
}

const user = { uid: "u1", email: null, displayName: null, photoURL: null }

/** Read the `<dd>` value rendered next to a `<dt>` label. */
function valueFor(label: string): string {
  const dt = screen.getByText(label)
  const dd = dt.parentElement?.querySelector("dd")
  return dd?.textContent ?? ""
}

function planWith(
  result: Partial<ShotMergeResult> = {},
): { patch: Record<string, unknown>; result: Omit<ShotMergeResult, "mergedShotId"> } {
  return {
    patch: {},
    result: {
      productsCombined: result.productsCombined ?? 3,
      talentAdded: result.talentAdded ?? 1,
      looksKept: result.looksKept ?? 1,
      referencesKept: result.referencesKept ?? 2,
    },
  }
}

function renderWizard(props: Partial<Parameters<typeof ShotMergeWizard>[0]> = {}) {
  const shotA = props.shotA ?? makeShot({ id: "a", title: "Shot A" })
  const shotB = props.shotB ?? makeShot({ id: "b", title: "Shot B" })
  return render(
    <ShotMergeWizard
      open={props.open ?? true}
      onOpenChange={props.onOpenChange ?? vi.fn()}
      clientId={props.clientId ?? "c1"}
      user={props.user ?? user}
      shotA={shotA}
      shotB={shotB}
      projectId={props.projectId ?? "p1"}
      onMerged={props.onMerged}
    />,
  )
}

describe("ShotMergeWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildShotMergePlanMock.mockReturnValue(planWith())
    executeShotMergeMock.mockResolvedValue({
      mergedShotId: "a",
      productsCombined: 3,
      talentAdded: 1,
      looksKept: 1,
      referencesKept: 2,
    } satisfies ShotMergeResult)
  })

  it("walks compare → preview → result", async () => {
    renderWizard()
    // Compare step renders both titles (as card headings).
    expect(screen.getByRole("heading", { name: "Shot A" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Shot B" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    // Preview computed.
    expect(buildShotMergePlanMock).toHaveBeenCalled()
    expect(screen.getByText("Products combined")).toBeInTheDocument()

    // Confirm gate then merge.
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: /Merge/i }))

    await waitFor(() =>
      expect(screen.getByText("Shots merged")).toBeInTheDocument(),
    )
  })

  it("Swap flips which shot is primary (passed to executeShotMerge)", async () => {
    const shotA = makeShot({ id: "a", title: "Shot A" })
    const shotB = makeShot({ id: "b", title: "Shot B" })
    renderWizard({ shotA, shotB })

    // Default: A primary.
    fireEvent.click(screen.getByRole("button", { name: "Swap" }))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: /Merge/i }))

    await waitFor(() => expect(executeShotMergeMock).toHaveBeenCalled())
    const arg = executeShotMergeMock.mock.calls[0]?.[0] as {
      primary: Shot
      secondary: Shot
    }
    expect(arg.primary.id).toBe("b")
    expect(arg.secondary.id).toBe("a")
  })

  it("mode toggle changes the preview counts", () => {
    buildShotMergePlanMock.mockImplementation(
      (args: { mode: ShotMergeMode }) =>
        args.mode === "combine"
          ? planWith({ productsCombined: 3, looksKept: 1 })
          : planWith({ productsCombined: 5, looksKept: 2 }),
    )
    renderWizard()

    // Default combine.
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(valueFor("Products combined")).toBe("3")

    // Back, choose separate.
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    fireEvent.click(screen.getByText("Keep as separate looks"))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))

    const calls = buildShotMergePlanMock.mock.calls
    const lastArg = calls[calls.length - 1]?.[0] as { mode: ShotMergeMode }
    expect(lastArg.mode).toBe("separate")
    expect(valueFor("Products combined")).toBe("5")
  })

  it("confirm checkbox gates the Merge button", () => {
    renderWizard()
    fireEvent.click(screen.getByRole("button", { name: "Next" }))

    const mergeBtn = screen.getByRole("button", { name: /Merge/i })
    expect(mergeBtn).toBeDisabled()

    fireEvent.click(screen.getByRole("checkbox"))
    expect(mergeBtn).not.toBeDisabled()
  })

  it("Merge calls executeShotMerge with primary/secondary/mode/clientId/user", async () => {
    const shotA = makeShot({ id: "a", title: "Shot A" })
    const shotB = makeShot({ id: "b", title: "Shot B" })
    renderWizard({ shotA, shotB, clientId: "c1", user })

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: /Merge/i }))

    await waitFor(() => expect(executeShotMergeMock).toHaveBeenCalledTimes(1))
    expect(executeShotMergeMock).toHaveBeenCalledWith({
      clientId: "c1",
      primary: shotA,
      secondary: shotB,
      mode: "combine",
      user,
    })
  })

  it("View shot navigates to the project-scoped shot-detail route", async () => {
    const onMerged = vi.fn()
    renderWizard({ projectId: "p9", onMerged })

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: /Merge/i }))
    await waitFor(() => screen.getByText("Shots merged"))

    fireEvent.click(screen.getByRole("button", { name: "View shot" }))
    expect(mockNavigate).toHaveBeenCalledWith("/projects/p9/shots/a")
    expect(onMerged).toHaveBeenCalled()
  })
})
