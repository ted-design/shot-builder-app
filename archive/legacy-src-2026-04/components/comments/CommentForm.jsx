import React, { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "../ui/button";
import RichTextEditor from "../shots/RichTextEditor";
import { stripMentionMarkup } from "../../lib/mentions";

/**
 * CommentForm - Form for creating/editing comments with mention support
 *
 * @param {object} props
 * @param {function} props.onSubmit - Callback when form is submitted (text) => void
 * @param {function} [props.onCancel] - Callback when cancel is clicked
 * @param {string} [props.initialText] - Initial text for editing
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.submitLabel] - Submit button label
 * @param {boolean} [props.isSubmitting] - Whether submission is in progress
 * @param {boolean} [props.showCancel] - Whether to show cancel button
 * @param {number} [props.maxLength] - Maximum character length (default 1000)
 */
export default function CommentForm({
  onSubmit,
  onCancel,
  initialText = "",
  placeholder = "Write a comment... Use @name to mention someone",
  submitLabel = "Comment",
  isSubmitting = false,
  showCancel = false,
  maxLength = 1000,
}) {
  const [text, setText] = useState(initialText);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate
    if (!text || !text.trim()) return;

    // Check length (strip HTML for accurate count)
    const plainText = stripMentionMarkup(text.replace(/<[^>]*>/g, ""));
    if (plainText.length > maxLength) {
      return;
    }

    // Submit
    onSubmit(text);

    // Clear form if not editing
    if (!initialText) {
      setText("");
    }
  };

  const handleCancel = () => {
    setText(initialText);
    if (onCancel) {
      onCancel();
    }
  };

  // Calculate character count
  const getCharacterCount = () => {
    const plainText = stripMentionMarkup(text.replace(/<[^>]*>/g, ""));
    return plainText.length;
  };

  const charCount = getCharacterCount();
  const isOverLimit = charCount > maxLength;
  const isNearLimit = charCount > maxLength * 0.9;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Editor */}
      <div className="relative">
        <RichTextEditor
          value={text}
          onChange={setText}
          disabled={isSubmitting}
          placeholder={placeholder}
          id="comment-editor"
          characterLimit={maxLength}
          minHeight="120px"
          maxHeight="260px"
          hideBubble
        />

        {/* Character Count */}
        {isNearLimit && (
          <div
            className={`absolute bottom-2 right-2 text-xs ${
              isOverLimit
                ? "text-red-600 dark:text-red-400 font-medium"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {charCount} / {maxLength}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Tip: Type <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">@</span>{" "}
          to mention someone
        </div>

        <div className="flex items-center gap-2">
          {showCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !text.trim() || isOverLimit}
            className="gap-1.5 whitespace-nowrap"
          >
            {isSubmitting ? (
              "Sending..."
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
