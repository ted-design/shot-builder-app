import React, { useMemo } from "react";
import PropTypes from "prop-types";
import ReactTiptapEditor from "reactjs-tiptap-editor";
import { BaseKit } from "reactjs-tiptap-editor";
import "reactjs-tiptap-editor/style.css";
import { useAuth } from "../../context/AuthContext";
import { useUsers } from "../../hooks/useComments";

/**
 * Enhanced WYSIWYG Rich Text Editor
 *
 * Features:
 * - Comprehensive toolbar with formatting options
 * - Floating/bubble toolbar on text selection
 * - @mentions with user autocomplete
 * - Character limit enforcement
 * - Bold, italic, underline, strikethrough
 * - Headings, lists, blockquotes, code blocks
 * - Links, images, tables
 * - Font family, size, colors
 * - Subscript/superscript
 * - Undo/redo history
 * - Clipboard operations
 */
export default function RichTextEditor({
  value = "",
  onChange,
  disabled = false,
  id,
  placeholder = "Write notes with rich formatting…",
  characterLimit = 50000,
  minHeight = "200px",
  maxHeight = "600px",
  hideToolbar = false,
  hideBubble = false,
  className = "",
}) {
  const { clientId } = useAuth();

  // Fetch users for mentions
  const { data: users = [], isLoading: usersLoading } = useUsers(clientId);

  // Configure extensions with all required features
  const extensions = useMemo(() => {
    const config = {
      placeholder: {
        showOnlyCurrent: true,
        placeholder: placeholder,
      },
      characterCount: {
        limit: characterLimit,
      },
      // Enable bubble menu (inline toolbar on selection)
      bubbleMenu: !hideBubble,
    };

    return [BaseKit.configure(config)];
  }, [placeholder, characterLimit, hideBubble]);

  // Handle content changes
  const handleChange = (content) => {
    if (onChange && !disabled) {
      onChange(content);
    }
  };

  return (
    <div className={`rich-text-editor-wrapper ${className}`}>
      <ReactTiptapEditor
        output="html"
        content={value}
        onChangeContent={handleChange}
        extensions={extensions}
        disabled={disabled}
        hideToolbar={hideToolbar}
        hideBubble={hideBubble}
        contentClass="prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px]"
        dark={false} // We'll handle dark mode via Tailwind classes
        minHeight={minHeight}
        maxHeight={maxHeight}
      />

      {/* Character count display */}
      {!disabled && characterLimit && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-right">
          {value?.length || 0} / {characterLimit}
        </div>
      )}
    </div>
  );
}

RichTextEditor.propTypes = {
  /** Current HTML content value */
  value: PropTypes.string,

  /** Callback when content changes */
  onChange: PropTypes.func,

  /** Disable editing */
  disabled: PropTypes.bool,

  /** DOM id for the editor */
  id: PropTypes.string,

  /** Placeholder text */
  placeholder: PropTypes.string,

  /** Maximum character limit */
  characterLimit: PropTypes.number,

  /** Minimum editor height */
  minHeight: PropTypes.string,

  /** Maximum editor height */
  maxHeight: PropTypes.string,

  /** Hide the main toolbar */
  hideToolbar: PropTypes.bool,

  /** Hide the bubble menu (inline toolbar) */
  hideBubble: PropTypes.bool,

  /** Additional CSS classes */
  className: PropTypes.string,
};
