/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ShotRequestStatusBadge } from "./ShotRequestStatusBadge"
import type { ShotRequestStatus } from "@/shared/types"

describe("ShotRequestStatusBadge", () => {
  const statuses: readonly { readonly status: ShotRequestStatus; readonly label: string }[] = [
    { status: "submitted", label: "Submitted" },
    { status: "triaged", label: "Triaged" },
    { status: "absorbed", label: "Absorbed" },
    { status: "rejected", label: "Rejected" },
  ]

  statuses.forEach(({ status, label }) => {
    it(`renders "${label}" for status "${status}"`, () => {
      render(<ShotRequestStatusBadge status={status} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it("passes className to StatusBadge", () => {
    const { container } = render(
      <ShotRequestStatusBadge status="submitted" className="test-class" />,
    )
    const badge = container.querySelector(".test-class")
    expect(badge).toBeInTheDocument()
  })
})
