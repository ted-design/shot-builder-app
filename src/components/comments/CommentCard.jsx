import React, { useState } from "react";
import { Edit2, Trash2 } from "lucide-react";
import Avatar from "../ui/Avatar";
import { Button } from "../ui/button";
import { renderMentions } from "../../lib/mentions";
import { formatDistanceToNow } from "date-fns";
import DOMPurify from "dompurify";

/**
 * CommentCard - Display individual comment with author info and actions
 *
 * @param {object} props
 * @param {object} props.comment - Comment object
 * @param {string} props.comment.id - Comment ID
 * @param {string} props.comment.text - Comment text with mentions
 * @param {string} props.comment.createdBy - User ID of comment author
 * @param {string} props.comment.createdByName - Display name of author
 * @param {string} [props.comment.createdByAvatar] - Avatar URL
 * @param {Date|object} props.comment.createdAt - Creation timestamp
 * @param {Date|object} [props.comment.updatedAt] - Update timestamp
 * @param {boolean} [props.comment.isEdited] - Whether comment was edited
 * @param {boolean} props.canEdit - Whether current user can edit this comment
 * @param {boolean} props.canDelete - Whether current user can delete this comment
 * @param {function} [props.onEdit] - Callback when edit button clicked
 * @param {function} [props.onDelete] - Callback when delete button clicked
 * @param {boolean} [props.isDeleting] - Whether delete is in progress
 */
export default function CommentCard({
  comment,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
  isDeleting = false,
}) {
  const [showActions, setShowActions] = useState(false);

  // Format timestamp
  const getTimestamp = () => {
    try {
      // Handle Firestore Timestamp objects
      const date =
        comment.createdAt?.toDate?.() ||
        (comment.createdAt instanceof Date ? comment.createdAt : new Date(comment.createdAt));

      return formatDistanceToNow(date, { addSuffix: true });
    } catch (err) {
      console.error("[CommentCard] Error formatting timestamp:", err);
      return "recently";
    }
  };

  // Render comment text with styled mentions and sanitization
  const renderCommentText = () => {
    const html = renderMentions(comment.text || "");
    // Sanitize HTML to prevent XSS attacks
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['span', 'b', 'i', 'strong', 'em', 'p', 'br', 'div'],
      ALLOWED_ATTR: {
        // Only allow class attribute on span elements (for mention badges)
        // and restrict to safe prefixes to prevent CSS-based attacks
        'span': ['class'],
      },
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
      // Prevent attribute-based XSS
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      // Prevent DOM clobbering
      SANITIZE_DOM: true,
      // Keep content safe
      KEEP_CONTENT: true,
    });
    return { __html: sanitized };
  };

  return (
    <div
      className="group relative rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 transition-shadow hover:shadow-md"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Header */}
      <div className="mb-2 flex items-start gap-3">
        {/* Avatar */}
        <Avatar
          src={comment.createdByAvatar}
          name={comment.createdByName || "Unknown User"}
          size="sm"
        />

        {/* Author Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
              {comment.createdByName || "Unknown User"}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {getTimestamp()}
            </span>
            {comment.isEdited && (
              <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                (edited)
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {(canEdit || canDelete) && (
          <div
            className={`flex items-center gap-1 transition-opacity ${
              showActions ? "opacity-100" : "opacity-0"
            }`}
          >
            {canEdit && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="rounded p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition"
                aria-label="Edit comment"
                disabled={isDeleting}
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
            {canDelete && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded p-1.5 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition"
                aria-label="Delete comment"
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Comment Text */}
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 break-words"
        dangerouslySetInnerHTML={renderCommentText()}
      />

      {/* Deleting Overlay */}
      {isDeleting && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-800/80 rounded-lg">
          <div className="text-sm text-slate-600 dark:text-slate-400">Deleting...</div>
        </div>
      )}
    </div>
  );
}
