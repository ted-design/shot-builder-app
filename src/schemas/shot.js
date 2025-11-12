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
 * Shot tag entry
 */
export const shotTagSchema = z.object({
  id: z.string().min(1, "Tag ID is required"),
  label: z.string().min(1, "Tag label is required").max(50),
  color: z.string().min(1, "Tag color is required"),
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
  tags: z.array(shotTagSchema).default([]),
});

/**
 * Image crop position schema (legacy - for backward compatibility)
 */
export const imageCropPositionSchema = z.object({
  x: z.number().min(0).max(100).default(50), // 0-100 percentage
  y: z.number().min(0).max(100).default(50), // 0-100 percentage
});

/**
 * Advanced image crop data schema
 * Used with react-easy-crop for full crop/zoom/rotate control
 */
export const imageCropDataSchema = z.object({
  x: z.number().min(0).max(100), // crop position x (percentage)
  y: z.number().min(0).max(100), // crop position y (percentage)
  width: z.number().min(0).max(100), // crop width (percentage)
  height: z.number().min(0).max(100), // crop height (percentage)
  zoom: z.number().min(1).max(3).default(1), // zoom level (1-3)
  rotation: z.number().min(-180).max(180).default(0), // rotation in degrees
  aspect: z.number().positive().nullable().optional(), // locked aspect ratio (e.g., 1.778 for 16:9) or null for free-form
});

/**
 * Image attachment schema
 * Represents a single image attached to a shot
 */
export const imageAttachmentSchema = z.object({
  id: z.string().min(1, "Attachment ID is required"),
  path: storagePathSchema,
  isPrimary: z.boolean().default(false),
  cropData: imageCropDataSchema.nullable().optional(),
  uploadedAt: timestampSchema,
  uploadedBy: userIdSchema,
  order: z.number().int().min(0).default(0),
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
  tags: z.array(shotTagSchema).default([]),
  notes: z.string().nullable().optional(),
  // Legacy single image fields (kept for backward compatibility)
  referenceImagePath: storagePathSchema,
  referenceImageCrop: imageCropPositionSchema.nullable().optional(),
  // New multiple image attachments
  attachments: z.array(imageAttachmentSchema).max(10, "Maximum 10 attachments allowed").default([]),
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
  tags: [],
};
