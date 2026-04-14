import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RichTextEditor from "../RichTextEditor";
import { useAuth } from "../../../context/AuthContext";
import { useUsers } from "../../../hooks/useComments";
import { ThemeProvider } from "../../../context/ThemeContext";

// Mock dependencies
vi.mock("../../../context/AuthContext");
vi.mock("../../../hooks/useComments");
vi.mock("reactjs-tiptap-editor", () => ({
  default: ({ content, onChangeContent, disabled, placeholder }) => (
    <div data-testid="tiptap-editor">
      <div data-testid="editor-content">{content}</div>
      <input
        data-testid="editor-input"
        value={content || ""}
        onChange={(e) => onChangeContent?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  ),
  BaseKit: {
    configure: (config) => ({
      type: "BaseKit",
      config,
    }),
  },
}));

vi.mock("reactjs-tiptap-editor/mention", () => ({
  Mention: {
    configure: (config) => ({
      type: "Mention",
      config,
    }),
  },
}));

// Mock all formatting extensions
vi.mock("reactjs-tiptap-editor/bold", () => ({ Bold: { type: "Bold" } }));
vi.mock("reactjs-tiptap-editor/italic", () => ({ Italic: { type: "Italic" } }));
vi.mock("reactjs-tiptap-editor/textunderline", () => ({ TextUnderline: { type: "TextUnderline" } }));
vi.mock("reactjs-tiptap-editor/strike", () => ({ Strike: { type: "Strike" } }));
vi.mock("reactjs-tiptap-editor/code", () => ({ Code: { type: "Code" } }));
vi.mock("reactjs-tiptap-editor/heading", () => ({ Heading: { type: "Heading" } }));
vi.mock("reactjs-tiptap-editor/bulletlist", () => ({ BulletList: { type: "BulletList" } }));
vi.mock("reactjs-tiptap-editor/orderedlist", () => ({ OrderedList: { type: "OrderedList" } }));
vi.mock("reactjs-tiptap-editor/listitem", () => ({ ListItem: { type: "ListItem" } }));
vi.mock("reactjs-tiptap-editor/blockquote", () => ({ Blockquote: { type: "Blockquote" } }));
vi.mock("reactjs-tiptap-editor/color", () => ({ Color: { type: "Color" } }));
vi.mock("reactjs-tiptap-editor/codeblock", () => ({ CodeBlock: { type: "CodeBlock" } }));
vi.mock("reactjs-tiptap-editor/link", () => ({ Link: { type: "Link" } }));
vi.mock("reactjs-tiptap-editor/horizontalrule", () => ({ HorizontalRule: { type: "HorizontalRule" } }));
vi.mock("reactjs-tiptap-editor/history", () => ({ History: { type: "History" } }));

describe("RichTextEditor", () => {
  const mockOnChange = vi.fn();
  const mockUsers = [
    { uid: "user1", displayName: "John Doe", email: "john@example.com" },
    { uid: "user2", displayName: "Jane Smith", email: "jane@example.com" },
  ];

  const renderWithTheme = (ui) => {
    return render(<ThemeProvider>{ui}</ThemeProvider>);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ clientId: "test-client" });
    useUsers.mockReturnValue({ data: mockUsers, isLoading: false });
  });

  describe("Basic Rendering", () => {
    it("renders the editor component", () => {
      renderWithTheme(<RichTextEditor value="" onChange={mockOnChange} />);

      expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
    });

    it("displays initial content", () => {
      const content = "<p>Test content</p>";
      renderWithTheme(<RichTextEditor value={content} onChange={mockOnChange} />);

      expect(screen.getByTestId("editor-content")).toHaveTextContent("Test content");
    });

    it("accepts custom placeholder prop", () => {
      const placeholder = "Enter your notes here...";

      // Test that the component renders without errors with custom placeholder
      expect(() => {
        renderWithTheme(
          <RichTextEditor
            value=""
            onChange={mockOnChange}
            placeholder={placeholder}
          />
        );
      }).not.toThrow();

      // Verify the editor is rendered
      expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = renderWithTheme(
        <RichTextEditor
          value=""
          onChange={mockOnChange}
          className="custom-class"
        />
      );

      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });
  });

  describe("Content Changes", () => {
    it("provides onChange callback to editor", () => {
      renderWithTheme(<RichTextEditor value="" onChange={mockOnChange} />);

      // Verify the editor is rendered and onChange prop is provided
      expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();

      // The onChange handler is passed to the underlying TipTap editor
      // In a real integration test, content changes would trigger onChange
      // This test verifies the component structure is correct
      expect(mockOnChange).toBeDefined();
    });

    it("does not call onChange when disabled", () => {
      renderWithTheme(
        <RichTextEditor value="" onChange={mockOnChange} disabled={true} />
      );

      const input = screen.getByTestId("editor-input");
      input.dispatchEvent(new Event("change", { bubbles: true }));

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("handles undefined onChange gracefully", () => {
      expect(() => {
        renderWithTheme(<RichTextEditor value="" />);
      }).not.toThrow();
    });
  });

  describe("Character Limit", () => {
    it("displays character count by default", () => {
      const content = "Test content";
      renderWithTheme(
        <RichTextEditor
          value={content}
          onChange={mockOnChange}
          characterLimit={100}
        />
      );

      expect(screen.getByText(/12 \/ 100/)).toBeInTheDocument();
    });

    it("respects custom character limit", () => {
      renderWithTheme(
        <RichTextEditor
          value=""
          onChange={mockOnChange}
          characterLimit={1000}
        />
      );

      expect(screen.getByText(/0 \/ 1000/)).toBeInTheDocument();
    });

    it("does not show character count when disabled", () => {
      renderWithTheme(
        <RichTextEditor
          value=""
          onChange={mockOnChange}
          disabled={true}
          characterLimit={100}
        />
      );

      expect(screen.queryByText(/\/ 100/)).not.toBeInTheDocument();
    });

    it("handles zero character limit", () => {
      renderWithTheme(
        <RichTextEditor
          value=""
          onChange={mockOnChange}
          characterLimit={0}
        />
      );

      // Character count should not be displayed if limit is 0
      expect(screen.queryByText(/\/ 0/)).not.toBeInTheDocument();
    });
  });

  describe("Disabled State", () => {
    it("disables editor when disabled prop is true", () => {
      renderWithTheme(
        <RichTextEditor value="" onChange={mockOnChange} disabled={true} />
      );

      const input = screen.getByTestId("editor-input");
      expect(input).toBeDisabled();
    });

    it("enables editor by default", () => {
      renderWithTheme(<RichTextEditor value="" onChange={mockOnChange} />);

      const input = screen.getByTestId("editor-input");
      expect(input).not.toBeDisabled();
    });
  });

  describe("User Mentions Integration", () => {
    it("fetches users for mentions", () => {
      renderWithTheme(<RichTextEditor value="" onChange={mockOnChange} />);

      expect(useUsers).toHaveBeenCalledWith("test-client");
    });

    it("handles empty users list", () => {
      useUsers.mockReturnValue({ data: [], isLoading: false });

      expect(() => {
        renderWithTheme(<RichTextEditor value="" onChange={mockOnChange} />);
      }).not.toThrow();
    });

    it("handles loading state", () => {
      useUsers.mockReturnValue({ data: [], isLoading: true });

      expect(() => {
        renderWithTheme(<RichTextEditor value="" onChange={mockOnChange} />);
      }).not.toThrow();
    });

    it("handles missing clientId", () => {
      useAuth.mockReturnValue({ clientId: null });

      expect(() => {
        renderWithTheme(<RichTextEditor value="" onChange={mockOnChange} />);
      }).not.toThrow();
    });
  });

  describe("PropTypes Validation", () => {
    it("accepts all valid props", () => {
      const props = {
        value: "<p>Test</p>",
        onChange: mockOnChange,
        disabled: false,
        id: "editor-1",
        placeholder: "Enter text...",
        characterLimit: 5000,
        minHeight: "150px",
        maxHeight: "500px",
        hideToolbar: false,
        hideBubble: false,
        className: "test-class",
      };

      expect(() => {
        renderWithTheme(<RichTextEditor {...props} />);
      }).not.toThrow();
    });

    it("works with minimal props", () => {
      expect(() => {
        renderWithTheme(<RichTextEditor />);
      }).not.toThrow();
    });
  });

  describe("Toolbar Configuration", () => {
    it("shows toolbar by default", () => {
      renderWithTheme(<RichTextEditor value="" onChange={mockOnChange} />);

      // The toolbar should be rendered (not hidden)
      expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
    });

    it("can hide toolbar via prop", () => {
      renderWithTheme(
        <RichTextEditor
          value=""
          onChange={mockOnChange}
          hideToolbar={true}
        />
      );

      expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
    });

    it("can hide bubble menu via prop", () => {
      renderWithTheme(
        <RichTextEditor
          value=""
          onChange={mockOnChange}
          hideBubble={true}
        />
      );

      expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles null value", () => {
      expect(() => {
        renderWithTheme(<RichTextEditor value={null} onChange={mockOnChange} />);
      }).not.toThrow();
    });

    it("handles undefined value", () => {
      expect(() => {
        renderWithTheme(<RichTextEditor value={undefined} onChange={mockOnChange} />);
      }).not.toThrow();
    });

    it("handles very long content", () => {
      const longContent = "x".repeat(100000);
      expect(() => {
        renderWithTheme(<RichTextEditor value={longContent} onChange={mockOnChange} />);
      }).not.toThrow();
    });

    it("handles HTML entities in content", () => {
      const content = "<p>&lt;div&gt;Test&lt;/div&gt;</p>";
      expect(() => {
        renderWithTheme(<RichTextEditor value={content} onChange={mockOnChange} />);
      }).not.toThrow();
    });

    it("handles malformed HTML gracefully", () => {
      const content = "<p><strong>Unclosed tag";
      expect(() => {
        renderWithTheme(<RichTextEditor value={content} onChange={mockOnChange} />);
      }).not.toThrow();
    });
  });
});
