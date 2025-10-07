/**
 * Common validation schemas used across multiple models
 */
import { z } from "zod";

/**
 * Timestamp validation - accepts Firestore timestamps, Date objects, or null
 */
export const timestampSchema = z
  .union([
    z.number().positive(),
    z.date(),
    z.object({
      seconds: z.number(),
      nanoseconds: z.number(),
    }),
    z.null(),
  ])
  .nullable()
  .optional();

/**
 * Firestore document ID - non-empty string
 */
export const docIdSchema = z.string().min(1, "Document ID is required");

/**
 * Optional Firestore document ID
 */
export const optionalDocIdSchema = z.string().optional();

/**
 * User ID schema (Firebase Auth UID)
 */
export const userIdSchema = z.string().min(1, "User ID is required").nullable().optional();

/**
 * Email validation
 */
export const emailSchema = z.string().email("Invalid email address");

/**
 * URL validation (optional)
 */
export const urlSchema = z
  .string()
  .url("Invalid URL")
  .or(z.literal(""))
  .nullable()
  .optional();

/**
 * Gender enum for products
 */
export const genderSchema = z.enum(["men", "mens", "women", "womens", "unisex", "other", ""]).optional();

/**
 * Status enum for products and SKUs
 */
export const productStatusSchema = z.enum(["active", "inactive", "archived", "discontinued"]);

/**
 * Soft delete fields
 */
export const softDeleteSchema = z.object({
  deleted: z.boolean().default(false),
  deletedAt: timestampSchema,
});

/**
 * Audit fields (createdAt, updatedAt, createdBy, updatedBy)
 */
export const auditFieldsSchema = z.object({
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  createdBy: userIdSchema,
  updatedBy: userIdSchema,
});

/**
 * Firebase Storage path
 */
export const storagePathSchema = z.string().nullable().optional();

/**
 * Array of strings (e.g., sizes, tags)
 */
export const stringArraySchema = z.array(z.string()).default([]);

/**
 * Notes/description field
 */
export const notesSchema = z.string().max(10000, "Notes too long (max 10,000 characters)").nullable().optional();
