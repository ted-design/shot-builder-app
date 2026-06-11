/// <reference types="@testing-library/jest-dom" />
// 5e-II — lifecycle menu rules-honesty split (spec §PR partition 5e-II,
// "Lifecycle menu rules-honesty fix"; same shape as the 5b-II schedules
// canDelete split).
//
// The page gates the MENU on canManageLifecycle (effective role); inside the
// menu, Transfer ("Move to another project…") and Copy-to-project gate on the
// GLOBAL admin/producer claim — the /shots move arm and the create-in-target
// arm are global-claim-only (firestore.rules:468-472), so a project-promoted
// producer (global crew/viewer + members-doc producer) would be rules-denied
// on them. Duplicate/delete stay effective-role (project-aware rules arms).
//
// The dropdown primitives are pass-through stubs: the SUBJECT is which items
// render per global claim, not Radix open/close mechanics.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { ReactNode } from "react"
import type { Shot } from "@/shared/types"

// Global claim — the subject of the split. Effective role is irrelevant in
// this component by design (the page applies it before mounting the menu).
const authState = vi.hoisted(() => ({ role: "producer" }))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    role: authState.role,
    clientId: "c1",
    user: { uid: "u1" },
    loading: false,
  }),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/features/shots/lib/shotLifecycleActions", () => ({
  copyShotToProject: vi.fn(),
  duplicateShotInProject: vi.fn(),
  moveShotToProject: vi.fn(),
  softDeleteShot: vi.fn(),
}))

vi.mock("@/features/projects/hooks/useProjects", () => ({
  mapProject: vi.fn((id: string, data: Record<string, unknown>) => ({ id, ...data })),
}))

// Pass-through dropdown stubs — content renders inline so item presence is
// directly assertable without driving Radix pointer events in jsdom.
vi.mock("@/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { readonly children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { readonly children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { readonly children?: ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({ children }: { readonly children?: ReactNode }) => (
    <div role="menuitem">{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

import { ShotLifecycleActionsMenu } from "@/features/shots/components/ShotLifecycleActionsMenu"

function makeShot(overrides: Partial<Shot> = {}): Shot {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Shot",
    projectId: overrides.projectId ?? "p1",
    clientId: overrides.clientId ?? "c1",
    status: overrides.status ?? "todo",
    talent: overrides.talent ?? [],
    products: overrides.products ?? [],
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    createdBy: overrides.createdBy ?? "u1",
  }
}

function renderMenu() {
  return render(
    <MemoryRouter>
      <ShotLifecycleActionsMenu shot={makeShot()} />
    </MemoryRouter>,
  )
}

describe("ShotLifecycleActionsMenu — Transfer/Copy global-claim gate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.role = "producer"
  })

  it("global producer: all four lifecycle items render", () => {
    renderMenu()

    expect(screen.getByText("Duplicate in project")).toBeInTheDocument()
    expect(screen.getByText("Copy to another project…")).toBeInTheDocument()
    expect(screen.getByText("Move to another project…")).toBeInTheDocument()
    expect(screen.getByText("Delete shot…")).toBeInTheDocument()
  })

  it("global admin: Transfer/Copy render", () => {
    authState.role = "admin"
    renderMenu()

    expect(screen.getByText("Copy to another project…")).toBeInTheDocument()
    expect(screen.getByText("Move to another project…")).toBeInTheDocument()
  })

  it("project-promoted producer (global crew): duplicate/delete render, Transfer/Copy do NOT", () => {
    authState.role = "crew"
    renderMenu()

    // Effective-role items survive (their rules arms are project-aware).
    expect(screen.getByText("Duplicate in project")).toBeInTheDocument()
    expect(screen.getByText("Delete shot…")).toBeInTheDocument()
    // Global-claim items hidden — the move/create-in-target arms would deny.
    expect(screen.queryByText("Copy to another project…")).not.toBeInTheDocument()
    expect(screen.queryByText("Move to another project…")).not.toBeInTheDocument()
  })

  it("project-promoted producer (global viewer): Transfer/Copy do NOT render", () => {
    authState.role = "viewer"
    renderMenu()

    expect(screen.getByText("Duplicate in project")).toBeInTheDocument()
    expect(screen.queryByText("Copy to another project…")).not.toBeInTheDocument()
    expect(screen.queryByText("Move to another project…")).not.toBeInTheDocument()
  })
})
