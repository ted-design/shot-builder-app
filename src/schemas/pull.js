/**
 * Pull validation schemas
 */
import { z } from "zod";
import {
  docIdSchema,
  optionalDocIdSchema,
  timestampSchema,
  auditFieldsSchema,
  stringArraySchema,
} from "./common.js";

/**
 * Pull status enum
 */
export const pullStatusSchema = z.enum(["draft", "published", "in-progress", "fulfilled"]).default("draft");

/**
 * Pull item (product in a pull)
 */
export const pullItemSchema = z.object({
  id: z.string().optional(),
  familyId: docIdSchema,
  familyName: z.string().min(1, "Product name is required"),
  styleNumber: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  skuId: optionalDocIdSchema,
  colorName: z.string().nullable().optional(),
  colorImagePath: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  quantity: z.number().int().min(1, "Quantity must be at least 1").default(1),
  quantityFulfilled: z.number().int().min(0).default(0),
  notes: z.string().max(500).nullable().optional(),
  status: z.enum(["pending", "fulfilled", "unavailable"]).default("pending"),
  changeOrders: z.array(z.any()).optional(), // Change order objects
});

/**
 * Pull document schema
 */
export const pullSchema = z.object({
  id: docIdSchema.optional(),
  name: z.string().min(1, "Pull name is required").max(200),
  title: z.string().min(1, "Pull title is required").max(200), // Legacy field
  status: pullStatusSchema,
  projectId: docIdSchema,
  items: z.array(pullItemSchema).default([]),
  shotIds: stringArraySchema,
  sortOrder: z.enum(["gender", "alpha", "custom"]).default("gender"),

  // Sharing fields
  shareEnabled: z.boolean().default(false),
  shareToken: z.string().nullable().optional(),
  shareExpiresAt: timestampSchema,

  ...auditFieldsSchema.shape,
});

/**
 * Pull creation payload
 */
export const createPullSchema = z.object({
  title: z.string().min(1, "Pull title is required").max(200),
  name: z.string().min(1, "Pull name is required").max(200),
  projectId: docIdSchema,
  status: pullStatusSchema,
  items: z.array(pullItemSchema).default([]),
  shotIds: stringArraySchema,
});

/**
 * Pull update payload
 */
export const updatePullSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(200).optional(),
  status: pullStatusSchema.optional(),
  items: z.array(pullItemSchema).optional(),
  shotIds: stringArraySchema.optional(),
  sortOrder: z.enum(["gender", "alpha", "custom"]).optional(),
  shareEnabled: z.boolean().optional(),
  shareToken: z.string().nullable().optional(),
  shareExpiresAt: timestampSchema.optional(),
});
