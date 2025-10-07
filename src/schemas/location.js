/**
 * Location validation schemas
 */
import { z } from "zod";
import {
  docIdSchema,
  auditFieldsSchema,
  storagePathSchema,
  notesSchema,
} from "./common.js";

/**
 * Location document schema
 */
export const locationSchema = z.object({
  id: docIdSchema.optional(),
  name: z.string().min(1, "Location name is required").max(200),
  address: z.string().max(500).nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  contactEmail: z.string().email().or(z.literal("")).nullable().optional(),
  notes: notesSchema,
  photoPath: storagePathSchema,
  archived: z.boolean().default(false),
  ...auditFieldsSchema.shape,
});

/**
 * Location creation payload
 */
export const createLocationSchema = z.object({
  name: z.string().min(1, "Location name is required").max(200),
  address: z.string().default(""),
  contactName: z.string().default(""),
  contactPhone: z.string().default(""),
  contactEmail: z.string().default(""),
  notes: z.string().default(""),
  photoFile: z.any().nullable().optional(), // File object
});

/**
 * Location update payload
 */
export const updateLocationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  notes: z.string().optional(),
  photoFile: z.any().nullable().optional(),
  archived: z.boolean().optional(),
});
