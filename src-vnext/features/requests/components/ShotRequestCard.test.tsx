/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import { ShotRequestCard } from "./ShotRequestCard"
import type { ShotRequest } from "@/shared/types"

function makeRequest(overrides: Partial<ShotRequest> = {}): ShotRequest {
  return {
    id: "r1",
    clientId: "c1",
    status: "submitted",
    priority: "normal",
    title: "New product shots needed",
    description: "Need shots of the fall collection",
    referenceUrls: null,
    deadline: null,
    notes: null,
    submittedBy: "u1",
    submittedByName: "Alice Smith",
    submittedAt: Timestamp.fromMillis(Date.now() - 60 * 60 * 1000),
    updatedAt: Timestamp.fromMillis(Date.now()),
    triagedBy: null,
    triagedAt: null,
    absorbedIntoProjectId: null,
    absorbedAsShotId: null,
    rejectionReason: null,
    ...overrides,
  }
}

describe("ShotRequestCard", () => {
  it("renders the request title", () => {
    render(
      <ShotRequestCard request={makeRequest()} selected={false} onClick={vi.fn()} />,
    )
    expect(screen.getByText("New product shots needed")).toBeInTheDocument()
  })

  it("renders the submitter name", () => {
    render(
      <ShotRequestCard request={makeRequest()} selected={false} onClick={vi.fn()} />,
    )
    expect(screen.getByText("Alice Smith")).toBeInTheDocument()
  })

  it("renders 'Unknown' when submittedByName is null", () => {
    render(
      <ShotRequestCard
        request={makeRequest({ submittedByName: null })}
        selected={false}
        onClick={vi.fn()}
      />,
    )
    expect(screen.getByText("Unknown")).toBeInTheDocument()
  })

  it("renders the status badge", () => {
    render(
      <ShotRequestCard request={makeRequest()} selected={false} onClick={vi.fn()} />,
    )
    expect(screen.getByText("Submitted")).toBeInTheDocument()
  })

  it("shows urgent indicator for urgent priority", () => {
    render(
      <ShotRequestCard
        request={makeRequest({ priority: "urgent" })}
        selected={false}
        onClick={vi.fn()}
      />,
    )
    expect(screen.getByLabelText("Urgent")).toBeInTheDocument()
  })

  it("does not show urgent indicator for normal priority", () => {
    render(
      <ShotRequestCard request={makeRequest()} selected={false} onClick={vi.fn()} />,
    )
    expect(screen.queryByLabelText("Urgent")).not.toBeInTheDocument()
  })

  it("calls onClick when clicked", () => {
    const onClick = vi.fn()
    render(
      <ShotRequestCard request={makeRequest()} selected={false} onClick={onClick} />,
    )
    fireEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("applies selected styles when selected is true", () => {
    const { container } = render(
      <ShotRequestCard request={makeRequest()} selected={true} onClick={vi.fn()} />,
    )
    const button = container.querySelector("button")
    expect(button?.className).toContain("border-l-[var(--color-primary)]")
  })
})
