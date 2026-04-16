/**
 * Talent validation schemas
 */
import { z } from "zod";
import {
  docIdSchema,
  emailSchema,
  auditFieldsSchema,
  storagePathSchema,
  notesSchema,
} from "./common.js";

/**
 * Talent document schema
 */
export const talentSchema = z.object({
  id: docIdSchema.optional(),
  name: z.string().min(1, "Talent name is required").max(200),
  email: z.string().email().or(z.literal("")).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  agency: z.string().max(200).nullable().optional(),
  notes: notesSchema,
  photoPath: storagePathSchema,
  archived: z.boolean().default(false),
  ...auditFieldsSchema.shape,
});

/**
 * Talent creation payload
 */
export const createTalentSchema = z.object({
  name: z.string().min(1, "Talent name is required").max(200),
  email: z.string().default(""),
  phone: z.string().default(""),
  agency: z.string().default(""),
  notes: z.string().default(""),
  photoFile: z.any().nullable().optional(), // File object
});

/**
 * Talent update payload
 */
export const updateTalentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  agency: z.string().optional(),
  notes: z.string().optional(),
  photoFile: z.any().nullable().optional(),
  archived: z.boolean().optional(),
});
