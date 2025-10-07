/**
 * Central export for all validation schemas
 *
 * Usage:
 * import { createProductFamilySchema, shotDraftSchema } from '@/schemas';
 */

// Common schemas
export * from "./common.js";

// Entity schemas
export * from "./product.js";
export * from "./shot.js";
export * from "./pull.js";
export * from "./project.js";
export * from "./talent.js";
export * from "./location.js";

/**
 * Helper function to validate data and return parsed result
 * Throws ZodError if validation fails
 */
export function validate(schema, data) {
  return schema.parse(data);
}

/**
 * Helper function to safely validate data
 * Returns { success: true, data } or { success: false, error }
 */
export function safeValidate(schema, data) {
  const result = schema.safeParse(data);
  return result;
}

/**
 * Helper to get human-readable error messages from Zod errors
 */
export function getValidationErrors(zodError) {
  return zodError.errors.map((err) => ({
    path: err.path.join("."),
    message: err.message,
  }));
}

/**
 * Helper to format validation errors for toast notifications
 */
export function formatValidationError(zodError) {
  const errors = getValidationErrors(zodError);
  if (errors.length === 1) {
    return errors[0].message;
  }
  return `Validation failed: ${errors.map((e) => e.message).join(", ")}`;
}
