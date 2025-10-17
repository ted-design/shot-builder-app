import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAvailableTags } from "../useAvailableTags";

// Mock the useShots hook
vi.mock("../useFirestoreQuery", () => ({
  useShots: vi.fn(),
}));

// Import after mocking
import { useShots } from "../useFirestoreQuery";

describe("useAvailableTags", () => {
  const mockClientId = "test-client";
  const mockProjectId = "test-project";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no shots exist", () => {
    useShots.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useAvailableTags(mockClientId, mockProjectId)
    );

    expect(result.current.availableTags).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it("aggregates unique tags from multiple shots", () => {
    const mockShots = [
      {
        id: "shot1",
        tags: [
          { id: "tag-1", label: "Outdoor", color: "blue" },
          { id: "tag-2", label: "Priority", color: "red" },
        ],
      },
      {
        id: "shot2",
        tags: [
          { id: "tag-1", label: "Outdoor", color: "blue" }, // Duplicate
          { id: "tag-3", label: "Action", color: "green" },
        ],
      },
      {
        id: "shot3",
        tags: [
          { id: "tag-4", label: "Close-up", color: "purple" },
        ],
      },
    ];

    useShots.mockReturnValue({
      data: mockShots,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useAvailableTags(mockClientId, mockProjectId)
    );

    // Should have 4 unique tags (tag-1 appears twice but should only be counted once)
    expect(result.current.availableTags).toHaveLength(4);

    // Check that each tag ID appears only once
    const tagIds = result.current.availableTags.map(tag => tag.id);
    expect(new Set(tagIds).size).toBe(4);

    // Verify tag structure
    expect(result.current.availableTags[0]).toHaveProperty("id");
    expect(result.current.availableTags[0]).toHaveProperty("label");
    expect(result.current.availableTags[0]).toHaveProperty("color");
  });

  it("sorts tags alphabetically by label", () => {
    const mockShots = [
      {
        id: "shot1",
        tags: [
          { id: "tag-1", label: "Zebra", color: "blue" },
          { id: "tag-2", label: "Alpha", color: "red" },
          { id: "tag-3", label: "Mike", color: "green" },
        ],
      },
    ];

    useShots.mockReturnValue({
      data: mockShots,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useAvailableTags(mockClientId, mockProjectId)
    );

    const labels = result.current.availableTags.map(tag => tag.label);
    expect(labels).toEqual(["Alpha", "Mike", "Zebra"]);
  });

  it("handles shots with no tags", () => {
    const mockShots = [
      { id: "shot1", tags: [] },
      { id: "shot2", tags: undefined },
      { id: "shot3" }, // No tags property
    ];

    useShots.mockReturnValue({
      data: mockShots,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useAvailableTags(mockClientId, mockProjectId)
    );

    expect(result.current.availableTags).toEqual([]);
  });

  it("filters out invalid tags (missing id or label)", () => {
    const mockShots = [
      {
        id: "shot1",
        tags: [
          { id: "tag-1", label: "Valid", color: "blue" },
          { id: "", label: "No ID", color: "red" }, // Invalid: empty id
          { id: "tag-2", label: "", color: "green" }, // Invalid: empty label
          { id: "tag-3", color: "purple" }, // Invalid: missing label
          { label: "No ID Tag", color: "yellow" }, // Invalid: missing id
          null, // Invalid: null
          undefined, // Invalid: undefined
        ],
      },
    ];

    useShots.mockReturnValue({
      data: mockShots,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useAvailableTags(mockClientId, mockProjectId)
    );

    // Should only have the one valid tag
    expect(result.current.availableTags).toHaveLength(1);
    expect(result.current.availableTags[0]).toEqual({
      id: "tag-1",
      label: "Valid",
      color: "blue",
    });
  });

  it("uses default gray color when tag color is missing", () => {
    const mockShots = [
      {
        id: "shot1",
        tags: [
          { id: "tag-1", label: "No Color" }, // Missing color
        ],
      },
    ];

    useShots.mockReturnValue({
      data: mockShots,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useAvailableTags(mockClientId, mockProjectId)
    );

    expect(result.current.availableTags[0].color).toBe("gray");
  });

  it("passes through loading state from useShots", () => {
    useShots.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    });

    const { result } = renderHook(() =>
      useAvailableTags(mockClientId, mockProjectId)
    );

    expect(result.current.isLoading).toBe(true);
  });

  it("passes through error state from useShots", () => {
    const mockError = new Error("Firestore error");
    useShots.mockReturnValue({
      data: [],
      isLoading: false,
      error: mockError,
    });

    const { result } = renderHook(() =>
      useAvailableTags(mockClientId, mockProjectId)
    );

    expect(result.current.error).toBe(mockError);
  });

  it("calls useShots with correct parameters", () => {
    useShots.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderHook(() => useAvailableTags(mockClientId, mockProjectId));

    expect(useShots).toHaveBeenCalledWith(mockClientId, mockProjectId);
  });

  it("recalculates tags when shots data changes", () => {
    const initialShots = [
      {
        id: "shot1",
        tags: [{ id: "tag-1", label: "Initial", color: "blue" }],
      },
    ];

    useShots.mockReturnValue({
      data: initialShots,
      isLoading: false,
      error: null,
    });

    const { result, rerender } = renderHook(() =>
      useAvailableTags(mockClientId, mockProjectId)
    );

    expect(result.current.availableTags).toHaveLength(1);
    expect(result.current.availableTags[0].label).toBe("Initial");

    // Update shots data
    const updatedShots = [
      {
        id: "shot1",
        tags: [
          { id: "tag-1", label: "Initial", color: "blue" },
          { id: "tag-2", label: "New Tag", color: "red" },
        ],
      },
    ];

    useShots.mockReturnValue({
      data: updatedShots,
      isLoading: false,
      error: null,
    });

    rerender();

    expect(result.current.availableTags).toHaveLength(2);
    expect(result.current.availableTags.map(t => t.label)).toContain("New Tag");
  });

  it("handles large number of shots efficiently", () => {
    // Create 100 shots with 10 tags each (1000 total tag instances, but only 10 unique)
    const mockShots = Array.from({ length: 100 }, (_, i) => ({
      id: `shot${i}`,
      tags: Array.from({ length: 10 }, (_, j) => ({
        id: `tag-${j}`, // 10 unique tag IDs (0-9)
        label: `Tag ${j}`,
        color: ["red", "blue", "green", "yellow", "purple"][j % 5],
      })),
    }));

    useShots.mockReturnValue({
      data: mockShots,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useAvailableTags(mockClientId, mockProjectId)
    );

    // Should deduplicate to only 10 unique tags
    expect(result.current.availableTags).toHaveLength(10);

    // Verify all tags are sorted
    const labels = result.current.availableTags.map(t => t.label);
    const sortedLabels = [...labels].sort();
    expect(labels).toEqual(sortedLabels);
  });
});
