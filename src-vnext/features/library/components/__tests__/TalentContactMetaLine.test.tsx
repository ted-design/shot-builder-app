/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { TalentContactMetaLine } from "@/features/library/components/TalentContactMetaLine"
import type { TalentRecord } from "@/shared/types"

function talent(overrides: Partial<TalentRecord> = {}): TalentRecord {
  return {
    id: "t1",
    name: "Alice",
    email: null,
    phone: null,
    url: null,
    ...overrides,
  } as TalentRecord
}

describe("TalentContactMetaLine", () => {
  it("shows all three fields for an editor even when empty (blanks stay fillable)", () => {
    render(<TalentContactMetaLine selected={talent()} canEdit busy={false} savePatch={vi.fn()} />)
    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByText("Phone")).toBeInTheDocument()
    expect(screen.getByText("Web")).toBeInTheDocument()
    expect(screen.queryByText("No contact details")).toBeNull()
  })

  it("suppresses empty fields for a read-only viewer", () => {
    render(
      <TalentContactMetaLine
        selected={talent({ email: "a@b.co" })}
        canEdit={false}
        busy={false}
        savePatch={vi.fn()}
      />,
    )
    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.queryByText("Phone")).toBeNull()
    expect(screen.queryByText("Web")).toBeNull()
  })

  it("shows a placeholder when read-only with no contact details at all", () => {
    render(<TalentContactMetaLine selected={talent()} canEdit={false} busy={false} savePatch={vi.fn()} />)
    expect(screen.getByText("No contact details")).toBeInTheDocument()
    expect(screen.queryByText("Email")).toBeNull()
  })
})
