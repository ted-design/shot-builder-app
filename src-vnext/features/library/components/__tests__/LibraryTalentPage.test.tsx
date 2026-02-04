/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    clientId: "c1",
    role: "producer",
    user: { uid: "u1" },
  }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/features/library/hooks/useTalentLibrary", () => ({
  useTalentLibrary: vi.fn(),
}))

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: () => ({ data: [], loading: false, error: null }),
}))

vi.mock("@/features/library/lib/talentWrites", () => ({
  createTalent: vi.fn(),
  updateTalent: vi.fn(),
  setTalentHeadshot: vi.fn(),
  removeTalentHeadshot: vi.fn(),
  addTalentToProject: vi.fn(),
  removeTalentFromProject: vi.fn(),
  uploadTalentPortfolioImages: vi.fn(),
  uploadTalentCastingImages: vi.fn(),
  deleteTalentImagePaths: vi.fn(),
}))

import { useTalentLibrary } from "@/features/library/hooks/useTalentLibrary"
import { createTalent, updateTalent } from "@/features/library/lib/talentWrites"
import LibraryTalentPage from "@/features/library/components/LibraryTalentPage"

function renderPage() {
  return render(
    <MemoryRouter>
      <LibraryTalentPage />
    </MemoryRouter>,
  )
}

describe("LibraryTalentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows empty state when no talent exists", () => {
    ;(useTalentLibrary as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    renderPage()
    expect(screen.getByText("No talent yet")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create talent" })).toBeInTheDocument()
  })

  it("creates a talent from the dialog", async () => {
    ;(useTalentLibrary as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    ;(createTalent as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
      "t1",
    )

    renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Create talent" }))
    const dialog = await screen.findByRole("dialog")

    fireEvent.change(within(dialog).getByPlaceholderText("Full name"), {
      target: { value: "Alex Rivera" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(createTalent).toHaveBeenCalledTimes(1)
    })

    expect(createTalent).toHaveBeenCalledWith({
      clientId: "c1",
      userId: "u1",
      name: "Alex Rivera",
      agency: null,
      email: null,
      phone: null,
      url: null,
      gender: null,
      notes: null,
      measurements: null,
      headshotFile: null,
    })
  })

  it("updates talent name via inline edit in the cockpit", async () => {
    ;(useTalentLibrary as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        {
          id: "t1",
          name: "Alex Rivera",
          agency: "IMG",
          email: null,
          phone: null,
          url: null,
          gender: null,
          notes: "",
          measurements: null,
          headshotPath: null,
          headshotUrl: null,
          galleryImages: [],
          castingSessions: [],
        },
      ],
      loading: false,
      error: null,
    })

    ;(updateTalent as unknown as { mockResolvedValue: () => void }).mockResolvedValue()

    renderPage()

    fireEvent.click(screen.getByText("Alex Rivera"))

    const nameField = within(screen.getByTestId("talent-details-name")).getByText("Alex Rivera")
    fireEvent.click(nameField)

    const input = screen.getByDisplayValue("Alex Rivera")
    fireEvent.change(input, { target: { value: "Alex R." } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(updateTalent).toHaveBeenCalledTimes(1)
    })

    expect(updateTalent).toHaveBeenCalledWith({
      clientId: "c1",
      userId: "u1",
      talentId: "t1",
      patch: { name: "Alex R." },
    })
  })

  it("creates a casting session", async () => {
    ;(useTalentLibrary as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        {
          id: "t1",
          name: "Alex Rivera",
          agency: "IMG",
          email: null,
          phone: null,
          url: null,
          gender: null,
          notes: "",
          measurements: null,
          headshotPath: null,
          headshotUrl: null,
          galleryImages: [],
          castingSessions: [],
        },
      ],
      loading: false,
      error: null,
    })

    ;(updateTalent as unknown as { mockResolvedValue: () => void }).mockResolvedValue()

    renderPage()
    fireEvent.click(screen.getByText("Alex Rivera"))

    fireEvent.click(screen.getByRole("button", { name: "Add casting" }))
    const dialog = await screen.findByRole("dialog")

    fireEvent.change(within(dialog).getByLabelText("Casting date"), {
      target: { value: "2026-01-30" },
    })
    fireEvent.change(within(dialog).getByLabelText("Casting title"), {
      target: { value: "Jan 30 casting" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }))

    await waitFor(() => {
      expect(updateTalent).toHaveBeenCalledTimes(1)
    })

    expect(updateTalent).toHaveBeenCalledWith({
      clientId: "c1",
      userId: "u1",
      talentId: "t1",
      patch: {
        castingSessions: [
          {
            id: expect.any(String),
            date: "2026-01-30",
            title: "Jan 30 casting",
            notes: null,
            images: [],
          },
        ],
      },
    })
  })
})
