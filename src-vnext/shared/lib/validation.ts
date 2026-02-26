import { z } from "zod"

/** Project name: required, 1-200 chars, trimmed. */
export const projectNameSchema = z
  .string()
  .trim()
  .min(1, "Project name is required")
  .max(200, "Project name must be 200 characters or fewer")

/** Shot title: required, 1-200 chars, trimmed. */
export const shotTitleSchema = z
  .string()
  .trim()
  .min(1, "Shot title is required")
  .max(200, "Shot title must be 200 characters or fewer")

/** Optional URL: empty string passes, non-empty must be a valid http(s) URL. */
export const optionalUrlSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (val.length === 0) return true
      try {
        const parsed = new URL(val)
        return parsed.protocol === "http:" || parsed.protocol === "https:"
      } catch {
        return false
      }
    },
    { message: "Must be a valid URL starting with https://" },
  )

/** Optional notes: empty string passes, max 5000 chars. */
export const optionalNotesSchema = z
  .string()
  .trim()
  .max(5000, "Notes must be 5,000 characters or fewer")

/**
 * Validates a single field and returns the error message (or null if valid).
 * Utility to avoid try/catch boilerplate in form handlers.
 */
export function validateField<T>(
  schema: z.ZodType<T>,
  value: unknown,
): string | null {
  const result = schema.safeParse(value)
  if (result.success) return null
  return result.error.issues[0]?.message ?? "Invalid value"
}
