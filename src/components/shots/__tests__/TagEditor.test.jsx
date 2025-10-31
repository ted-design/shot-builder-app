import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TagEditor } from "../TagEditor";
import { DEFAULT_TAGS, DEFAULT_TAG_GROUPS } from "../../../lib/defaultTags";

// Mock the useAvailableTags hook
vi.mock("../../../hooks/useAvailableTags", () => ({
  useAvailableTags: vi.fn(),
}));

// Import after mocking
import { useAvailableTags } from "../../../hooks/useAvailableTags";

describe("TagEditor", () => {
  const mockOnChange = vi.fn();
  const mockClientId = "test-client";
  const mockProjectId = "test-project";

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    useAvailableTags.mockReturnValue({
      availableTags: [],
      isLoading: false,
      error: null,
    });
  });

  it("renders with no existing tags", () => {
    render(
      <TagEditor
        tags={[]}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Add tag")).toBeInTheDocument();
    expect(screen.getByText("No tags added")).toBeInTheDocument();
  });

  it("displays existing tags", () => {
    const existingTags = [
      { id: "tag-1", label: "Outdoor", color: "blue" },
      { id: "tag-2", label: "Priority", color: "red" },
    ];

    render(
      <TagEditor
        tags={existingTags}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    expect(screen.getByText("Outdoor")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
  });

  it("opens dropdown when Add tag button is clicked", () => {
    render(
      <TagEditor
        tags={[]}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    const addButton = screen.getByText("Add tag");
    fireEvent.click(addButton);

    expect(screen.getByPlaceholderText("e.g., Priority, Outdoor...")).toBeInTheDocument();
  });

  it("shows available tags when dropdown is opened and input is empty", () => {
    const availableTags = [
      { id: "tag-1", label: "Outdoor", color: "blue" },
      { id: "tag-2", label: "Priority", color: "red" },
      { id: "tag-3", label: "Action", color: "green" },
    ];

    useAvailableTags.mockReturnValue({
      availableTags,
      isLoading: false,
      error: null,
    });

    render(
      <TagEditor
        tags={[]}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    fireEvent.click(screen.getByText("Add tag"));

    expect(screen.getByText("Select from existing tags (3)")).toBeInTheDocument();
    expect(screen.getByText("Outdoor")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("Project Tags")).toBeInTheDocument();
  });

  it("filters available tags based on input", () => {
    const availableTags = [
      { id: "tag-1", label: "Outdoor", color: "blue" },
      { id: "tag-2", label: "Priority", color: "red" },
      { id: "tag-3", label: "Action", color: "green" },
    ];

    useAvailableTags.mockReturnValue({
      availableTags,
      isLoading: false,
      error: null,
    });

    render(
      <TagEditor
        tags={[]}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    fireEvent.click(screen.getByText("Add tag"));
    const input = screen.getByPlaceholderText("e.g., Priority, Outdoor...");

    fireEvent.change(input, { target: { value: "out" } });

    expect(screen.getByText("Click to reuse existing tag (1 match)")).toBeInTheDocument();
    expect(screen.getByText("Outdoor")).toBeInTheDocument();
    expect(screen.getByText("Project Tags")).toBeInTheDocument();
    expect(screen.queryByText("Priority")).not.toBeInTheDocument();
    expect(screen.queryByText("Action")).not.toBeInTheDocument();
  });

  it("allows selecting an existing tag", () => {
    const availableTags = [
      { id: "tag-1", label: "Outdoor", color: "blue" },
    ];

    useAvailableTags.mockReturnValue({
      availableTags,
      isLoading: false,
      error: null,
    });

    render(
      <TagEditor
        tags={[]}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    fireEvent.click(screen.getByText("Add tag"));

    // Find and click the "Outdoor" tag button in the dropdown
    const tagButtons = screen.getAllByText("Outdoor");
    fireEvent.click(tagButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "tag-1",
        label: "Outdoor",
        color: "blue",
        groupId: "project",
        groupLabel: "Project Tags",
        isDefault: false,
      }),
    ]);
  });

  it("shows create option when input doesn't match existing tags", () => {
    const availableTags = [
      { id: "tag-1", label: "Outdoor", color: "blue" },
    ];

    useAvailableTags.mockReturnValue({
      availableTags,
      isLoading: false,
      error: null,
    });

    render(
      <TagEditor
        tags={[]}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    fireEvent.click(screen.getByText("Add tag"));
    const input = screen.getByPlaceholderText("e.g., Priority, Outdoor...");

    fireEvent.change(input, { target: { value: "New Tag" } });

    expect(screen.getByText('Create "New Tag"')).toBeInTheDocument();
  });

  it("displays grouped default tags from the library", () => {
    useAvailableTags.mockReturnValue({
      availableTags: DEFAULT_TAGS,
      isLoading: false,
      error: null,
    });

    render(
      <TagEditor
        tags={[]}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    fireEvent.click(screen.getByText("Add tag"));

    expect(
      screen.getByText(`Select from existing tags (${DEFAULT_TAGS.length})`)
    ).toBeInTheDocument();

    DEFAULT_TAG_GROUPS.forEach((group) => {
      expect(screen.getByText(group.label)).toBeInTheDocument();
    });

    expect(screen.getAllByText("Default").length).toBeGreaterThan(0);
  });

  it("shows a message when every available tag is already added", () => {
    const availableTags = [
      { id: "tag-1", label: "Outdoor", color: "blue" },
    ];

    useAvailableTags.mockReturnValue({
      availableTags,
      isLoading: false,
      error: null,
    });

    render(
      <TagEditor
        tags={availableTags}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    fireEvent.click(screen.getByText("Add tag"));

    expect(
      screen.getByText("All available tags are already added. Start typing to create a new tag.")
    ).toBeInTheDocument();
  });

  it("allows creating a new tag with color selection", async () => {
    render(
      <TagEditor
        tags={[]}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    fireEvent.click(screen.getByText("Add tag"));
    const input = screen.getByPlaceholderText("e.g., Priority, Outdoor...");

    fireEvent.change(input, { target: { value: "New Tag" } });
    fireEvent.click(screen.getByText('Create "New Tag"'));

    // Color picker should now be visible
    expect(screen.getByText("Color")).toBeInTheDocument();

    // Select a color (red)
    const colorButtons = screen.getAllByRole("button");
    const redButton = colorButtons.find(btn => btn.getAttribute("aria-label") === "Select red color");
    if (redButton) {
      fireEvent.click(redButton);
    }

    // Click Create Tag button
    fireEvent.click(screen.getByText("Create Tag"));

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: "New Tag",
            color: expect.any(String),
            groupId: "project",
            groupLabel: "Project Tags",
            isDefault: false,
          })
        ])
      );
    });
  });

  it("prevents duplicate tags by label (case-insensitive)", () => {
    const existingTags = [
      { id: "tag-1", label: "Outdoor", color: "blue" },
    ];

    render(
      <TagEditor
        tags={existingTags}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    fireEvent.click(screen.getByText("Add tag"));
    const input = screen.getByPlaceholderText("e.g., Priority, Outdoor...");

    fireEvent.change(input, { target: { value: "outdoor" } }); // lowercase
    fireEvent.click(screen.getByText('Create "outdoor"'));
    fireEvent.click(screen.getByText("Create Tag"));

    // Should not add duplicate
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("removes tags when remove button is clicked", () => {
    const existingTags = [
      { id: "tag-1", label: "Outdoor", color: "blue" },
      { id: "tag-2", label: "Priority", color: "red" },
    ];

    render(
      <TagEditor
        tags={existingTags}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    // Find remove button for "Outdoor" tag
    const removeButtons = screen.getAllByLabelText(/remove/i);
    fireEvent.click(removeButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith([
      { id: "tag-2", label: "Priority", color: "red" },
    ]);
  });

  it("excludes already-added tags from available tags list", () => {
    const availableTags = [
      { id: "tag-1", label: "Outdoor", color: "blue" },
      { id: "tag-2", label: "Priority", color: "red" },
    ];

    const currentTags = [
      { id: "tag-1", label: "Outdoor", color: "blue" },
    ];

    useAvailableTags.mockReturnValue({
      availableTags,
      isLoading: false,
      error: null,
    });

    render(
      <TagEditor
        tags={currentTags}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    fireEvent.click(screen.getByText("Add tag"));

    // Should only show Priority, not Outdoor (which is already added)
    expect(screen.getByText("Select from existing tags (1)")).toBeInTheDocument();

    // Find all instances of "Priority" text
    const priorityElements = screen.getAllByText("Priority");
    expect(priorityElements.length).toBeGreaterThan(0);

    // Outdoor should only appear in the current tags list, not in available tags
    const outdoorElements = screen.getAllByText("Outdoor");
    // Should be exactly 1 (the one in the current tags display)
    expect(outdoorElements.length).toBe(1);
  });

  it("closes dropdown when Escape key is pressed", () => {
    render(
      <TagEditor
        tags={[]}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    fireEvent.click(screen.getByText("Add tag"));
    expect(screen.getByPlaceholderText("e.g., Priority, Outdoor...")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByPlaceholderText("e.g., Priority, Outdoor...")).not.toBeInTheDocument();
  });

  it("closes dropdown when clicking outside", () => {
    render(
      <div>
        <div data-testid="outside">Outside element</div>
        <TagEditor
          tags={[]}
          onChange={mockOnChange}
          clientId={mockClientId}
          projectId={mockProjectId}
        />
      </div>
    );

    fireEvent.click(screen.getByText("Add tag"));
    expect(screen.getByPlaceholderText("e.g., Priority, Outdoor...")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));

    expect(screen.queryByPlaceholderText("e.g., Priority, Outdoor...")).not.toBeInTheDocument();
  });

  it("calls useAvailableTags with correct parameters", () => {
    render(
      <TagEditor
        tags={[]}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    expect(useAvailableTags).toHaveBeenCalledWith(mockClientId, mockProjectId);
  });

  it("handles Enter key to create new tag", async () => {
    render(
      <TagEditor
        tags={[]}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    fireEvent.click(screen.getByText("Add tag"));
    const input = screen.getByPlaceholderText("e.g., Priority, Outdoor...");

    fireEvent.change(input, { target: { value: "Quick Tag" } });
    fireEvent.click(screen.getByText('Create "Quick Tag"'));

    // Now in color picker mode, press Enter
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: "Quick Tag",
          })
        ])
      );
    });
  });

  it("navigates back from color picker when Back button is clicked", () => {
    render(
      <TagEditor
        tags={[]}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    fireEvent.click(screen.getByText("Add tag"));
    const input = screen.getByPlaceholderText("e.g., Priority, Outdoor...");

    fireEvent.change(input, { target: { value: "New Tag" } });
    fireEvent.click(screen.getByText('Create "New Tag"'));

    expect(screen.getByText("Color")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Back"));

    expect(screen.queryByText("Color")).not.toBeInTheDocument();
    expect(screen.getByText('Create "New Tag"')).toBeInTheDocument();
  });

  it("shows existing tag when typing exact label (case-insensitive)", () => {
    const availableTags = [
      { id: "tag-1", label: "Outdoor", color: "blue" },
    ];

    useAvailableTags.mockReturnValue({
      availableTags,
      isLoading: false,
      error: null,
    });

    render(
      <TagEditor
        tags={[]}
        onChange={mockOnChange}
        clientId={mockClientId}
        projectId={mockProjectId}
      />
    );

    fireEvent.click(screen.getByText("Add tag"));
    const input = screen.getByPlaceholderText("e.g., Priority, Outdoor...");

    // Type exact match (case-insensitive)
    fireEvent.change(input, { target: { value: "outdoor" } });

    // Should show matching tag in the list
    expect(screen.getByText("Click to reuse existing tag (1 match)")).toBeInTheDocument();

    // Should NOT show create option since there's an exact match
    expect(screen.queryByText('Create "outdoor"')).not.toBeInTheDocument();

    // Click the existing tag to select it
    const tagButtons = screen.getAllByText("Outdoor");
    fireEvent.click(tagButtons[0]);

    // Should reuse the existing tag
    expect(mockOnChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "tag-1",
        label: "Outdoor",
        color: "blue",
        groupId: "project",
        groupLabel: "Project Tags",
        isDefault: false,
      }),
    ]);
  });
});
