/**
 * TanStack Query mutation hooks for Firestore operations
 *
 * These hooks provide optimistic updates and automatic cache invalidation
 * for create, update, and delete operations.
 *
 * Benefits:
 * - Instant UI updates with optimistic updates
 * - Automatic cache invalidation and refetching
 * - Consistent error handling
 * - Reduced boilerplate code
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { queryKeys } from "./useFirestoreQuery";
import { toast } from "../lib/toast";
import { describeFirebaseError } from "../lib/firebaseErrors";

/**
 * Hook for creating a new shot
 *
 * @param {string} clientId - Client ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 *
 * @example
 * const createShot = useCreateShot(clientId, {
 *   onSuccess: () => toast.success({ title: "Shot created" })
 * });
 * createShot.mutate({ shotData });
 */
export function useCreateShot(clientId, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shotData) => {
      const shotsRef = collection(db, "clients", clientId, "shots");
      const docRef = await addDoc(shotsRef, {
        ...shotData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deleted: false,
      });
      return { id: docRef.id, ...shotData };
    },
    onSuccess: (newShot, variables) => {
      // Invalidate shots query to refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.shots(clientId, newShot.projectId),
      });

      if (options.onSuccess) {
        options.onSuccess(newShot, variables);
      }
    },
    onError: (error, variables, context) => {
      const { code, message } = describeFirebaseError(error, "Failed to create shot");
      console.error("[useCreateShot] Error:", error);
      toast.error({ title: "Failed to create shot", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
  });
}

/**
 * Hook for updating a shot
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 *
 * @example
 * const updateShot = useUpdateShot(clientId, projectId);
 * updateShot.mutate({ shotId: "123", updates: { name: "New name" } });
 */
export function useUpdateShot(clientId, projectId, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ shotId, updates }) => {
      const shotRef = doc(db, "clients", clientId, "shots", shotId);
      await updateDoc(shotRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      return { shotId, updates };
    },
    onMutate: async ({ shotId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.shots(clientId, projectId),
      });

      // Snapshot previous value
      const previousShots = queryClient.getQueryData(queryKeys.shots(clientId, projectId));

      // Optimistically update cache
      queryClient.setQueryData(queryKeys.shots(clientId, projectId), (old) => {
        if (!old) return old;
        return old.map((shot) =>
          shot.id === shotId ? { ...shot, ...updates } : shot
        );
      });

      return { previousShots };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousShots) {
        queryClient.setQueryData(
          queryKeys.shots(clientId, projectId),
          context.previousShots
        );
      }

      const { code, message } = describeFirebaseError(error, "Failed to update shot");
      console.error("[useUpdateShot] Error:", error);
      toast.error({ title: "Failed to update shot", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
    onSuccess: (data, variables, context) => {
      // Invalidate to ensure sync with server
      queryClient.invalidateQueries({
        queryKey: queryKeys.shots(clientId, projectId),
      });

      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
  });
}

/**
 * Hook for deleting a shot (soft delete)
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 *
 * @example
 * const deleteShot = useDeleteShot(clientId, projectId);
 * deleteShot.mutate({ shotId: "123" });
 */
export function useDeleteShot(clientId, projectId, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ shotId }) => {
      const shotRef = doc(db, "clients", clientId, "shots", shotId);
      await updateDoc(shotRef, {
        deleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { shotId };
    },
    onMutate: async ({ shotId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.shots(clientId, projectId),
      });

      // Snapshot previous value
      const previousShots = queryClient.getQueryData(queryKeys.shots(clientId, projectId));

      // Optimistically remove from cache
      queryClient.setQueryData(queryKeys.shots(clientId, projectId), (old) => {
        if (!old) return old;
        return old.filter((shot) => shot.id !== shotId);
      });

      return { previousShots };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousShots) {
        queryClient.setQueryData(
          queryKeys.shots(clientId, projectId),
          context.previousShots
        );
      }

      const { code, message } = describeFirebaseError(error, "Failed to delete shot");
      console.error("[useDeleteShot] Error:", error);
      toast.error({ title: "Failed to delete shot", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
    onSuccess: (data, variables, context) => {
      // Invalidate to ensure sync with server
      queryClient.invalidateQueries({
        queryKey: queryKeys.shots(clientId, projectId),
      });

      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
  });
}

/**
 * Hook for bulk updating shots
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 *
 * @example
 * const bulkUpdateShots = useBulkUpdateShots(clientId, projectId);
 * bulkUpdateShots.mutate({
 *   shotIds: ["123", "456"],
 *   updates: { location: "Studio A" }
 * });
 */
export function useBulkUpdateShots(clientId, projectId, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ shotIds, updates }) => {
      const batch = writeBatch(db);
      const BATCH_LIMIT = 500;

      // Process in batches of 500 (Firestore limit)
      for (let i = 0; i < shotIds.length; i += BATCH_LIMIT) {
        const batchIds = shotIds.slice(i, i + BATCH_LIMIT);
        const currentBatch = writeBatch(db);

        batchIds.forEach((shotId) => {
          const shotRef = doc(db, "clients", clientId, "shots", shotId);
          currentBatch.update(shotRef, {
            ...updates,
            updatedAt: serverTimestamp(),
          });
        });

        await currentBatch.commit();
      }

      return { shotIds, updates };
    },
    onSuccess: (data, variables, context) => {
      // Invalidate shots query
      queryClient.invalidateQueries({
        queryKey: queryKeys.shots(clientId, projectId),
      });

      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      const { code, message } = describeFirebaseError(error, "Failed to bulk update shots");
      console.error("[useBulkUpdateShots] Error:", error);
      toast.error({ title: "Failed to bulk update shots", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
  });
}

/**
 * Hook for creating a new project
 *
 * @param {string} clientId - Client ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useCreateProject(clientId, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectData) => {
      const projectsRef = collection(db, "clients", clientId, "projects");
      const docRef = await addDoc(projectsRef, {
        ...projectData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { id: docRef.id, ...projectData };
    },
    onSuccess: (newProject, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects(clientId),
      });

      if (options.onSuccess) {
        options.onSuccess(newProject, variables);
      }
    },
    onError: (error, variables, context) => {
      const { code, message } = describeFirebaseError(error, "Failed to create project");
      console.error("[useCreateProject] Error:", error);
      toast.error({ title: "Failed to create project", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
  });
}

/**
 * Hook for updating a project
 *
 * @param {string} clientId - Client ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useUpdateProject(clientId, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, updates }) => {
      const projectRef = doc(db, "clients", clientId, "projects", projectId);
      await updateDoc(projectRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      return { projectId, updates };
    },
    onMutate: async ({ projectId, updates }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.projects(clientId),
      });

      const previousProjects = queryClient.getQueryData(queryKeys.projects(clientId));

      queryClient.setQueryData(queryKeys.projects(clientId), (old) => {
        if (!old) return old;
        return old.map((project) =>
          project.id === projectId ? { ...project, ...updates } : project
        );
      });

      return { previousProjects };
    },
    onError: (error, variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(queryKeys.projects(clientId), context.previousProjects);
      }

      const { code, message } = describeFirebaseError(error, "Failed to update project");
      console.error("[useUpdateProject] Error:", error);
      toast.error({ title: "Failed to update project", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects(clientId),
      });

      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
  });
}

/**
 * Hook for creating a new product
 *
 * @param {string} clientId - Client ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useCreateProduct(clientId, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData) => {
      const productsRef = collection(db, "clients", clientId, "productFamilies");
      const docRef = await addDoc(productsRef, {
        ...productData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { id: docRef.id, ...productData };
    },
    onSuccess: (newProduct, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.products(clientId),
      });

      if (options.onSuccess) {
        options.onSuccess(newProduct, variables);
      }
    },
    onError: (error, variables, context) => {
      const { code, message } = describeFirebaseError(error, "Failed to create product");
      console.error("[useCreateProduct] Error:", error);
      toast.error({ title: "Failed to create product", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
  });
}

/**
 * Hook for updating a product
 *
 * @param {string} clientId - Client ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useUpdateProduct(clientId, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, updates }) => {
      const productRef = doc(db, "clients", clientId, "productFamilies", productId);
      await updateDoc(productRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      return { productId, updates };
    },
    onMutate: async ({ productId, updates }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.products(clientId),
      });

      const previousProducts = queryClient.getQueryData(queryKeys.products(clientId));

      queryClient.setQueryData(queryKeys.products(clientId), (old) => {
        if (!old) return old;
        return old.map((product) =>
          product.id === productId ? { ...product, ...updates } : product
        );
      });

      return { previousProducts };
    },
    onError: (error, variables, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(queryKeys.products(clientId), context.previousProducts);
      }

      const { code, message } = describeFirebaseError(error, "Failed to update product");
      console.error("[useUpdateProduct] Error:", error);
      toast.error({ title: "Failed to update product", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.products(clientId),
      });

      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
  });
}
