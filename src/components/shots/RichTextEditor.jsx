import React, { useMemo } from "react";
import PropTypes from "prop-types";
import ReactTiptapEditor from "reactjs-tiptap-editor";
import { BaseKit } from "reactjs-tiptap-editor";
import Mention from "@tiptap/extension-mention";
import tippy from "tippy.js";
import "reactjs-tiptap-editor/style.css";
import "tippy.js/dist/tippy.css";
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
    const baseKitConfig = {
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

    // Configure mention extension with user data
    const mentionConfig = {
      HTMLAttributes: {
        class: "mention px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300",
      },
      suggestion: {
        items: ({ query }) => {
          if (!users || users.length === 0) return [];

          return users
            .filter((user) => {
              const name = user.displayName || user.email || "";
              return name.toLowerCase().includes(query.toLowerCase());
            })
            .slice(0, 5)
            .map((user) => ({
              id: user.uid,
              label: user.displayName || user.email,
            }));
        },
        render: () => {
          let component;
          let popup;

          return {
            onStart: (props) => {
              component = document.createElement("div");
              component.className =
                "mention-suggestions bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg overflow-hidden";

              const list = document.createElement("div");
              list.className = "mention-list max-h-60 overflow-y-auto";

              if (props.items.length === 0) {
                list.innerHTML = '<div class="px-3 py-2 text-sm text-slate-500">No users found</div>';
              } else {
                props.items.forEach((item, index) => {
                  const button = document.createElement("button");
                  button.className = `mention-item w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    index === props.selectedIndex ? "bg-slate-100 dark:bg-slate-700" : ""
                  }`;
                  button.textContent = item.label;
                  button.onclick = () => props.command(item);
                  list.appendChild(button);
                });
              }

              component.appendChild(list);

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },

            onUpdate(props) {
              const list = component.querySelector(".mention-list");
              if (!list) return;

              if (props.items.length === 0) {
                list.innerHTML = '<div class="px-3 py-2 text-sm text-slate-500">No users found</div>';
              } else {
                list.innerHTML = "";
                props.items.forEach((item, index) => {
                  const button = document.createElement("button");
                  button.className = `mention-item w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    index === props.selectedIndex ? "bg-slate-100 dark:bg-slate-700" : ""
                  }`;
                  button.textContent = item.label;
                  button.onclick = () => props.command(item);
                  list.appendChild(button);
                });
              }

              popup[0].setProps({
                getReferenceClientRect: props.clientRect,
              });
            },

            onKeyDown(props) {
              if (props.event.key === "Escape") {
                popup[0].hide();
                return true;
              }
              return false;
            },

            onExit() {
              popup[0].destroy();
            },
          };
        },
      },
    };

    return [
      BaseKit.configure(baseKitConfig),
      Mention.configure(mentionConfig),
    ];
  }, [placeholder, characterLimit, hideBubble, users]);

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
