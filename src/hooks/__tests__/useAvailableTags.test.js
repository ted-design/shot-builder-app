import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAvailableTags } from "../useAvailableTags";
import { DEFAULT_TAGS } from "../../lib/defaultTags";

// Mock the useShots hook
vi.mock("../useFirestoreQuery", () => ({
  useShots: vi.fn(),
}));

// Import after mocking
import { useShots } from "../useFirestoreQuery";

describe("useAvailableTags", () => {
  const mockClientId = "test-client";
  const mockProjectId = "test-project";
  const getSortedDefaultTags = () => [...DEFAULT_TAGS].sort((a, b) => a.label.localeCompare(b.label));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default tags when no shots exist", () => {
    useShots.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useAvailableTags(mockClientId, mockProjectId)
    );

    const expectedDefaults = getSortedDefaultTags();

    expect(result.current.availableTags).toEqual(expectedDefaults);
    expect(result.current.availableTags).toHaveLength(DEFAULT_TAGS.length);
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

    const expectedLength = DEFAULT_TAGS.length + 4;
    expect(result.current.availableTags).toHaveLength(expectedLength);

    const tagIds = result.current.availableTags.map(tag => tag.id);
    expect(new Set(tagIds).size).toBe(expectedLength);

    // Ensure default tag IDs are present
    DEFAULT_TAGS.forEach((defaultTag) => {
      expect(tagIds).toContain(defaultTag.id);
    });

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
    const sortedLabels = [...labels].sort((a, b) => a.localeCompare(b));
    expect(labels).toEqual(sortedLabels);

    const trackedLabels = ["Alpha", "Mike", "Zebra"];
    const customOrdering = result.current.availableTags
      .filter((tag) => trackedLabels.includes(tag.label))
      .map((tag) => tag.label);

    expect(customOrdering).toEqual(trackedLabels);
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

    expect(result.current.availableTags).toEqual(getSortedDefaultTags());
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

    const { availableTags } = result.current;

    expect(availableTags).toHaveLength(DEFAULT_TAGS.length + 1);

    const validTag = availableTags.find((tag) => tag.id === "tag-1");
    expect(validTag).toMatchObject({
      id: "tag-1",
      label: "Valid",
      color: "blue",
      groupId: "project",
      groupLabel: "Project Tags",
      isDefault: false,
    });

    const invalidIds = ["", "tag-2", "tag-3"];
    invalidIds.forEach((invalidId) => {
      expect(availableTags.some((tag) => tag.id === invalidId)).toBe(false);
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

    const missingColorTag = result.current.availableTags.find((tag) => tag.id === "tag-1");
    expect(missingColorTag?.color).toBe("gray");
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

    expect(result.current.availableTags).toHaveLength(DEFAULT_TAGS.length + 1);
    expect(result.current.availableTags.some((tag) => tag.id === "tag-1" && tag.label === "Initial")).toBe(true);

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

    expect(result.current.availableTags).toHaveLength(DEFAULT_TAGS.length + 2);
    expect(result.current.availableTags.some((tag) => tag.id === "tag-2" && tag.label === "New Tag")).toBe(true);
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

    // Should deduplicate to default tags plus the 10 unique tags from shots
    expect(result.current.availableTags).toHaveLength(DEFAULT_TAGS.length + 10);

    // Verify all tags are sorted
    const labels = result.current.availableTags.map(t => t.label);
    const sortedLabels = [...labels].sort();
    expect(labels).toEqual(sortedLabels);
  });
});
