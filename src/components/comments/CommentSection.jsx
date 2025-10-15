import React, { useState } from "react";
import { MessageSquare } from "lucide-react";
import CommentCard from "./CommentCard";
import CommentForm from "./CommentForm";
import { useComments, useCreateComment, useUpdateComment, useDeleteComment } from "../../hooks/useComments";
import { useAuth } from "../../context/AuthContext";
import { toast } from "../../lib/toast";
import { createMentionNotifications } from "../../lib/notifications";
import { stripMentionMarkup } from "../../lib/mentions";

/**
 * CommentSection - Main comment interface for shots
 *
 * @param {object} props
 * @param {string} props.clientId - Client ID
 * @param {string} props.shotId - Shot ID to show comments for
 * @param {string} [props.shotName] - Name of the shot for notification context
 */
export default function CommentSection({ clientId, shotId, shotName }) {
  const { user } = useAuth();
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);

  // Fetch comments
  const { data: comments = [], isLoading, error } = useComments(clientId, shotId);

  // Mutations
  const createComment = useCreateComment(clientId, shotId, {
    onSuccess: () => {
      toast.success("Comment added");
    },
    onError: (err) => {
      console.error("[CommentSection] Create error:", err);
      toast.error("Failed to add comment");
    },
    onNotificationCreate: async (mentionedUserIds, comment) => {
      // Trigger notifications for mentions
      if (mentionedUserIds && mentionedUserIds.length > 0 && user) {
        try {
          // Strip HTML and mention markup for preview
          const plainText = stripMentionMarkup(comment.text.replace(/<[^>]*>/g, ""));

          await createMentionNotifications(clientId, mentionedUserIds, {
            authorId: user.uid,
            authorName: user.displayName || user.email || "Someone",
            shotId: shotId,
            shotName: shotName || "a shot",
            commentText: plainText,
          });
        } catch (err) {
          console.error("[CommentSection] Failed to create mention notifications:", err);
          // Don't show error to user - notifications are not critical
        }
      }
    },
  });

  const updateComment = useUpdateComment(clientId, shotId, editingCommentId, {
    onSuccess: () => {
      toast.success("Comment updated");
      setEditingCommentId(null);
    },
    onError: (err) => {
      console.error("[CommentSection] Update error:", err);
      toast.error("Failed to update comment");
    },
  });

  const deleteComment = useDeleteComment(clientId, shotId, deletingCommentId, {
    onSuccess: () => {
      toast.success("Comment deleted");
      setDeletingCommentId(null);
    },
    onError: (err) => {
      console.error("[CommentSection] Delete error:", err);
      toast.error("Failed to delete comment");
      setDeletingCommentId(null);
    },
  });

  // Handlers
  const handleCreateComment = (text) => {
    createComment.mutate({ text });
  };

  const handleUpdateComment = (text) => {
    updateComment.mutate({ text });
  };

  const handleDeleteComment = (commentId) => {
    if (!window.confirm("Delete this comment? This action cannot be undone.")) {
      return;
    }
    setDeletingCommentId(commentId);
    deleteComment.mutate();
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
  };

  // Find comment being edited
  const editingComment = editingCommentId
    ? comments.find((c) => c.id === editingCommentId)
    : null;

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <MessageSquare className="h-4 w-4" />
          <span>Loading comments...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
        <p className="text-sm text-red-700 dark:text-red-400">
          Failed to load comments. Please refresh the page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Comments</h3>
          {comments.length > 0 && (
            <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              {comments.length}
            </span>
          )}
        </div>
      </div>

      {/* Comment Form */}
      {!editingCommentId && (
        <CommentForm
          onSubmit={handleCreateComment}
          isSubmitting={createComment.isPending}
          placeholder="Write a comment... Use @name to mention someone"
        />
      )}

      {/* Comment List */}
      {comments.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-8 text-center">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-slate-400 dark:text-slate-500" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No comments yet. Be the first to comment!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const isAuthor = user && comment.createdBy === user.uid;
            const isDeleting = deletingCommentId === comment.id;
            const isEditing = editingCommentId === comment.id;

            // Show edit form for this comment
            if (isEditing && editingComment) {
              return (
                <div key={comment.id} className="rounded-lg border border-primary bg-primary/5 dark:bg-primary/10 p-4">
                  <div className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                    Editing comment
                  </div>
                  <CommentForm
                    initialText={editingComment.text}
                    onSubmit={handleUpdateComment}
                    onCancel={handleCancelEdit}
                    isSubmitting={updateComment.isPending}
                    submitLabel="Save"
                    showCancel={true}
                  />
                </div>
              );
            }

            // Show comment card
            return (
              <CommentCard
                key={comment.id}
                comment={comment}
                canEdit={isAuthor && !isDeleting}
                canDelete={isAuthor && !isDeleting}
                onEdit={() => setEditingCommentId(comment.id)}
                onDelete={() => handleDeleteComment(comment.id)}
                isDeleting={isDeleting}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
