import { useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { sanitizeNotesHtml } from "../../lib/sanitize";

const colorOptions = [
  { label: "Slate", value: "#1f2937" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Emerald", value: "#10b981" },
  { label: "Rose", value: "#f43f5e" },
];

const ensureFocus = (element) => {
  if (!element) return;
  element.focus();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

export default function NotesEditor({ value = "", onChange, disabled = false, id }) {
  const editorRef = useRef(null);
  const lastHtmlRef = useRef("");

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const safeValue = sanitizeNotesHtml(value || "");
    if (lastHtmlRef.current === safeValue) return;
    if (editor.innerHTML !== safeValue) {
      editor.innerHTML = safeValue;
    }
    lastHtmlRef.current = safeValue;
  }, [value]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const safeValue = sanitizeNotesHtml(editor.innerHTML);
    if (editor.innerHTML !== safeValue) {
      editor.innerHTML = safeValue;
    }
    if (lastHtmlRef.current === safeValue) return;
    lastHtmlRef.current = safeValue;
    onChange?.(safeValue);
  };

  const handleCommand = (command, valueArg) => {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    if (typeof document.execCommand !== "function") return;
    ensureFocus(editor);
    document.execCommand(command, false, valueArg);
    setTimeout(emitChange, 0);
  };

  const handlePaste = (event) => {
    if (disabled) return;
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    if (typeof document.execCommand === "function") {
      document.execCommand("insertText", false, text);
    } else {
      const editor = editorRef.current;
      if (!editor) return;
      ensureFocus(editor);
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      selection.deleteFromDocument();
      const node = document.createTextNode(text);
      const range = selection.getRangeAt(0);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    setTimeout(emitChange, 0);
  };

  const handleInput = () => {
    if (disabled) return;
    emitChange();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onMouseDown={(event) => {
            event.preventDefault();
            handleCommand("bold");
          }}
          disabled={disabled}
        >
          Bold
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onMouseDown={(event) => {
            event.preventDefault();
            handleCommand("italic");
          }}
          disabled={disabled}
        >
          Italic
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onMouseDown={(event) => {
            event.preventDefault();
            handleCommand("removeFormat");
          }}
          disabled={disabled}
        >
          Clear
        </Button>
        <div className="flex items-center gap-1">
          {colorOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              className="h-8 w-8 rounded-full border border-slate-200"
              style={{ backgroundColor: option.value }}
              onMouseDown={(event) => {
                event.preventDefault();
                handleCommand("foreColor", option.value);
              }}
              aria-label={`Set text colour to ${option.label}`}
              disabled={disabled}
            >
              <span className="sr-only">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div
        id={id}
        ref={editorRef}
        className={`min-h-[140px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60 ${
          disabled ? "pointer-events-none bg-slate-50 text-slate-500" : ""
        }`}
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        data-placeholder="Write notes with basic formatting…"
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={emitChange}
        onPaste={handlePaste}
      />
    </div>
  );
}
