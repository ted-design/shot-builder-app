/**
 * Shot validation schemas
 */
import { z } from "zod";
import {
  docIdSchema,
  optionalDocIdSchema,
  timestampSchema,
  userIdSchema,
  softDeleteSchema,
  auditFieldsSchema,
  storagePathSchema,
  stringArraySchema,
} from "./common.js";

/**
 * Shot status enum
 */
export const shotStatusSchema = z.enum(["todo", "in_progress", "complete", "on_hold"]).default("todo");

/**
 * Shot product payload (product within a shot)
 */
export const shotProductSchema = z.object({
  productId: docIdSchema,
  productName: z.string().min(1, "Product name is required"),
  styleNumber: z.string().nullable().optional(),
  colourId: optionalDocIdSchema,
  colourName: z.string().nullable().optional(),
  colourImagePath: storagePathSchema,
  thumbnailImagePath: storagePathSchema,
  size: z.string().nullable().optional(),
  sizeScope: z.enum(["all", "single", "pending"]).default("all"),
  status: z.enum(["pending-size", "complete"]).default("complete"),
});

/**
 * Shot talent entry
 */
export const shotTalentSchema = z.object({
  talentId: docIdSchema,
  name: z.string().min(1, "Talent name is required"),
});

/**
 * Shot draft schema (for creating/editing shots)
 */
export const shotDraftSchema = z.object({
  name: z.string().trim().min(1, "Shot name is required").max(200),
  description: z.string().trim().max(1000).optional().default(""),
  type: z.string().trim().max(100).optional().default(""),
  status: shotStatusSchema,
  date: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "Enter date as YYYY-MM-DD",
    }),
  locationId: optionalDocIdSchema,
  projectId: optionalDocIdSchema,
  products: z.array(shotProductSchema).default([]),
  talent: z.array(shotTalentSchema).default([]),
});

/**
 * Shot document schema (full Firestore document)
 */
export const shotSchema = z.object({
  id: docIdSchema.optional(),
  name: z.string().min(1, "Shot name is required").max(200),
  description: z.string().max(1000).nullable().optional(),
  type: z.string().max(100).nullable().optional(),
  status: shotStatusSchema,
  date: timestampSchema,
  locationId: optionalDocIdSchema,
  locationName: z.string().nullable().optional(),
  projectId: docIdSchema,
  products: z.array(shotProductSchema).default([]),
  productIds: stringArraySchema,
  talent: z.array(shotTalentSchema).default([]),
  talentIds: stringArraySchema,
  notes: z.string().nullable().optional(),
  ...softDeleteSchema.shape,
  ...auditFieldsSchema.shape,
});

/**
 * Shot update payload (partial updates)
 */
export const updateShotSchema = shotDraftSchema.partial();

// Re-export for backward compatibility with existing shotDraft.js
export const shotProductPayloadSchema = shotProductSchema;
export const initialShotDraft = {
  name: "",
  description: "",
  type: "",
  status: "todo",
  date: "",
  locationId: "",
  products: [],
  talent: [],
};
