import React, { useMemo, useState } from "react";
import { MessageSquare, Plus, Minus } from "lucide-react";
import CommentCard from "./CommentCard";
import CommentForm from "./CommentForm";
import { useComments, useCreateComment, useUpdateComment, useDeleteComment } from "../../hooks/useComments";
import { useAuth } from "../../context/AuthContext";
import { toast } from "../../lib/toast";
import { createMentionNotifications } from "../../lib/notifications";
import { stripMentionMarkup } from "../../lib/mentions";
import { Button } from "../ui/button";

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
  const [showComposer, setShowComposer] = useState(false);

  // Fetch comments
  const { data: comments = [], isLoading, error } = useComments(clientId, shotId);

  const hasComments = comments.length > 0;
  const commentCountLabel = useMemo(() => {
    if (!hasComments) return "No comments yet";
    if (comments.length === 1) return "1 comment";
    return `${comments.length} comments`;
  }, [hasComments, comments.length]);

  // Mutations
  const createComment = useCreateComment(clientId, shotId, {
    onSuccess: () => {
      toast.success("Comment added");
      setShowComposer(false);
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

  const deleteComment = useDeleteComment(clientId, shotId, {
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
    deleteComment.mutate({ commentId });
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
      <div className="rounded-card border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
        <p className="text-sm text-red-700 dark:text-red-400">
          Failed to load comments. Please refresh the page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <MessageSquare className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Comments</h3>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {commentCountLabel}
          </span>
        </div>
        {!editingCommentId && (
          <Button
            type="button"
            size="sm"
            variant={showComposer ? "ghost" : "outline"}
            className="flex items-center gap-1 text-xs"
            onClick={() => setShowComposer((value) => !value)}
          >
            {showComposer ? (
              <>
                <Minus className="h-3.5 w-3.5" />
                Hide composer
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add comment
              </>
            )}
          </Button>
        )}
      </div>

      {/* Comment Form */}
      {!editingCommentId && showComposer && (
        <CommentForm
          onSubmit={handleCreateComment}
          isSubmitting={createComment.isPending}
          placeholder="Share an update… Use @mention to loop someone in"
          onCancel={() => setShowComposer(false)}
          showCancel
        />
      )}

      {/* Comment List */}
      {hasComments ? (
        <div className="space-y-3">
          {comments.map((comment) => {
            const isAuthor = user && comment.createdBy === user.uid;
            const isDeleting = deletingCommentId === comment.id;
            const isEditing = editingCommentId === comment.id;

            // Show edit form for this comment
            if (isEditing && editingComment) {
              return (
                <div key={comment.id} className="rounded-card border border-primary bg-primary/5 dark:bg-primary/10 p-4">
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
                onEdit={() => {
                  setShowComposer(false);
                  setEditingCommentId(comment.id);
                }}
                onDelete={() => handleDeleteComment(comment.id)}
                isDeleting={isDeleting}
                initiallyCollapsed
              />
            );
          })}
        </div>
      ) : (
        !showComposer && (
          <div className="rounded-md border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            No comments yet. Use Add comment to start the thread.
          </div>
        )
      )}
    </div>
  );
}
