import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ShotAssetsSection from "../workspace/ShotAssetsSection";

vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "test-user", displayName: "Test User", email: "test@example.com" },
    clientId: "test-client",
  }),
}));

describe("ShotAssetsSection - tags", () => {
  it("renders tags read-only (no tags Edit button) and normalizes legacy tag shapes", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ShotAssetsSection
          shot={{
            id: "shot-1",
            projectId: "project-1",
            tags: [
              "Urgent",
              { id: "tag-2", label: "Outdoor", color: "blue" },
            ],
            talent: [],
            locationId: null,
          }}
          talentOptions={[]}
          locationOptions={[]}
          readOnly={false}
        />
      </QueryClientProvider>
    );

    // Section is collapsed by default
    fireEvent.click(screen.getByRole("button", { name: /assets/i }));

    expect(screen.getByText("Urgent")).toBeInTheDocument();
    expect(screen.getByText("Outdoor")).toBeInTheDocument();

    // Talent + Location have Edit buttons; Tags must not add a third
    expect(screen.getAllByRole("button", { name: /edit/i })).toHaveLength(2);
  });
});

