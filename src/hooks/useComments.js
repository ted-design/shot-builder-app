/**
 * TanStack Query hooks for comment operations
 *
 * Provides realtime comment subscriptions and CRUD mutations
 * with optimistic updates and automatic cache invalidation.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { queryKeys } from "./useFirestoreQuery";
import { getMentionedUserIds } from "../lib/mentions";
import { useAuth } from "../context/AuthContext";

/**
 * Hook for fetching comments with realtime updates
 *
 * @param {string} clientId - Client ID
 * @param {string} shotId - Shot ID to fetch comments for
 * @param {object} options - Query options
 * @returns {object} Query result with data, loading, error states
 *
 * @example
 * const { data: comments, isLoading } = useComments(clientId, shotId);
 */
export function useComments(clientId, shotId, options = {}) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.comments(clientId, shotId);

  // Initial query with cache
  const result = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clientId || !shotId) return [];

      const commentsRef = collection(
        db,
        "clients",
        clientId,
        "shots",
        shotId,
        "comments"
      );
      const q = query(commentsRef, orderBy("createdAt", "desc"));

      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((comment) => !comment.isDeleted);
    },
    enabled: !!clientId && !!shotId,
    staleTime: 1000 * 30, // 30 seconds - comments change frequently
    ...options,
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!clientId || !shotId) return;

    const commentsRef = collection(
      db,
      "clients",
      clientId,
      "shots",
      shotId,
      "comments"
    );
    const q = query(commentsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const comments = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((comment) => !comment.isDeleted);

        // Update cache with realtime data
        queryClient.setQueryData(queryKey, comments);
      },
      (error) => {
        console.error("[useComments] Subscription error:", error);
      }
    );

    return () => unsubscribe();
  }, [clientId, shotId, queryClient, queryKey]);

  return result;
}

/**
 * Hook for creating a new comment
 *
 * @param {string} clientId - Client ID
 * @param {string} shotId - Shot ID to add comment to
 * @param {object} options - Mutation options
 * @returns {object} Mutation result with mutate function and states
 *
 * @example
 * const createComment = useCreateComment(clientId, shotId, {
 *   onSuccess: (comment) => console.log('Comment created:', comment),
 *   onNotificationCreate: (mentionedUserIds) => { ... }
 * });
 *
 * createComment.mutate({
 *   text: 'Great shot! @[John Doe](user123)',
 * });
 */
export function useCreateComment(clientId, shotId, options = {}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = queryKeys.comments(clientId, shotId);

  return useMutation({
    mutationFn: async ({ text }) => {
      if (!clientId || !shotId || !user) {
        throw new Error("Missing required parameters");
      }

      // Extract mentioned user IDs from comment text
      const mentionedUserIds = getMentionedUserIds(text);

      const commentsRef = collection(
        db,
        "clients",
        clientId,
        "shots",
        shotId,
        "comments"
      );

      const commentData = {
        text,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || "Unknown User",
        createdByAvatar: user.photoURL || null,
        mentionedUserIds,
        isEdited: false,
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(commentsRef, commentData);

      return {
        id: docRef.id,
        ...commentData,
        createdAt: new Date(), // Temporary for optimistic update
        updatedAt: new Date(),
      };
    },
    onMutate: async (newComment) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousComments = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      if (previousComments) {
        queryClient.setQueryData(queryKey, (old) => [
          {
            // Use crypto.randomUUID() to prevent race condition with Date.now()
            id: `temp-${crypto.randomUUID()}`,
            text: newComment.text,
            createdBy: user.uid,
            createdByName: user.displayName || user.email || "Unknown User",
            createdByAvatar: user.photoURL || null,
            mentionedUserIds: getMentionedUserIds(newComment.text),
            isEdited: false,
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          ...(old || []),
        ]);
      }

      return { previousComments };
    },
    onError: (err, newComment, context) => {
      // Rollback to previous value on error
      if (context?.previousComments) {
        queryClient.setQueryData(queryKey, context.previousComments);
      }
      console.error("[useCreateComment] Error:", err);
    },
    onSuccess: (data) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey });

      // Call notification callback if provided
      if (options.onNotificationCreate && data.mentionedUserIds?.length > 0) {
        options.onNotificationCreate(data.mentionedUserIds, data);
      }
    },
    ...options,
  });
}

/**
 * Hook for updating an existing comment
 *
 * @param {string} clientId - Client ID
 * @param {string} shotId - Shot ID
 * @param {string} commentId - Comment ID to update
 * @param {object} options - Mutation options
 * @returns {object} Mutation result with mutate function and states
 *
 * @example
 * const updateComment = useUpdateComment(clientId, shotId, commentId);
 *
 * updateComment.mutate({
 *   text: 'Updated comment text',
 * });
 */
export function useUpdateComment(clientId, shotId, commentId, options = {}) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.comments(clientId, shotId);

  return useMutation({
    mutationFn: async ({ text }) => {
      if (!clientId || !shotId || !commentId) {
        throw new Error("Missing required parameters");
      }

      // Extract mentioned user IDs from updated text
      const mentionedUserIds = getMentionedUserIds(text);

      const commentRef = doc(
        db,
        "clients",
        clientId,
        "shots",
        shotId,
        "comments",
        commentId
      );

      const updateData = {
        text,
        mentionedUserIds,
        isEdited: true,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(commentRef, updateData);

      return {
        id: commentId,
        ...updateData,
        updatedAt: new Date(), // Temporary for optimistic update
      };
    },
    onMutate: async (updates) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousComments = queryClient.getQueryData(queryKey);

      // Optimistically update
      if (previousComments) {
        queryClient.setQueryData(queryKey, (old) =>
          old.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  text: updates.text,
                  mentionedUserIds: getMentionedUserIds(updates.text),
                  isEdited: true,
                  updatedAt: new Date(),
                }
              : comment
          )
        );
      }

      return { previousComments };
    },
    onError: (err, updates, context) => {
      // Rollback on error
      if (context?.previousComments) {
        queryClient.setQueryData(queryKey, context.previousComments);
      }
      console.error("[useUpdateComment] Error:", err);
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey });
    },
    ...options,
  });
}

/**
 * Hook for soft-deleting a comment
 *
 * @param {string} clientId - Client ID
 * @param {string} shotId - Shot ID
 * @param {string} commentId - Comment ID to delete
 * @param {object} options - Mutation options
 * @returns {object} Mutation result with mutate function and states
 *
 * @example
 * const deleteComment = useDeleteComment(clientId, shotId, commentId);
 *
 * deleteComment.mutate();
 */
export function useDeleteComment(clientId, shotId, commentId, options = {}) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.comments(clientId, shotId);

  return useMutation({
    mutationFn: async () => {
      if (!clientId || !shotId || !commentId) {
        throw new Error("Missing required parameters");
      }

      const commentRef = doc(
        db,
        "clients",
        clientId,
        "shots",
        shotId,
        "comments",
        commentId
      );

      const updateData = {
        isDeleted: true,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(commentRef, updateData);

      return { id: commentId };
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousComments = queryClient.getQueryData(queryKey);

      // Optimistically remove the comment
      if (previousComments) {
        queryClient.setQueryData(queryKey, (old) =>
          old.filter((comment) => comment.id !== commentId)
        );
      }

      return { previousComments };
    },
    onError: (err, _, context) => {
      // Rollback on error
      if (context?.previousComments) {
        queryClient.setQueryData(queryKey, context.previousComments);
      }
      console.error("[useDeleteComment] Error:", err);
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey });
    },
    ...options,
  });
}

/**
 * Hook for fetching all users in a client (for mention autocomplete)
 *
 * @param {string} clientId - Client ID
 * @param {object} options - Query options
 * @returns {object} Query result with data, loading, error states
 *
 * @example
 * const { data: users, isLoading } = useUsers(clientId);
 */
export function useUsers(clientId, options = {}) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.users(clientId);

  const result = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clientId) return [];

      const usersRef = collection(db, "clients", clientId, "users");
      const q = query(usersRef, orderBy("displayName", "asc"));

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 5, // 5 minutes - users don't change often
    ...options,
  });

  // Realtime subscription
  useEffect(() => {
    if (!clientId) return;

    const usersRef = collection(db, "clients", clientId, "users");
    const q = query(usersRef, orderBy("displayName", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const users = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        queryClient.setQueryData(queryKey, users);
      },
      (error) => {
        console.error("[useUsers] Subscription error:", error);
      }
    );

    return () => unsubscribe();
  }, [clientId, queryClient, queryKey]);

  return result;
}
