/**
 * Project validation schemas
 */
import { z } from "zod";
import {
  docIdSchema,
  timestampSchema,
  auditFieldsSchema,
  urlSchema,
  notesSchema,
  stringArraySchema,
} from "./common.js";

/**
 * Project status
 */
export const projectStatusSchema = z.enum(["active", "archived", "completed"]);

/**
 * Project member role
 */
export const projectMemberRoleSchema = z.enum(["producer", "stylist", "assistant", "viewer"]);

/**
 * Project member entry
 */
export const projectMemberSchema = z.object({
  role: projectMemberRoleSchema,
  joinedAt: z.number().positive(),
});

/**
 * Project document schema
 */
export const projectSchema = z.object({
  id: docIdSchema.optional(),
  name: z.string().min(1, "Project name is required").max(200),
  shootDates: stringArraySchema,
  briefUrl: urlSchema,
  notes: notesSchema,
  members: z.record(projectMemberSchema).default({}), // userId -> memberInfo
  status: projectStatusSchema.optional(),
  archivedAt: timestampSchema,
  archivedBy: z.string().optional(),
  deletedAt: timestampSchema,
  ...auditFieldsSchema.shape,
});

/**
 * Project creation payload
 */
export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  shootDates: z.array(z.string()).default([]),
  briefUrl: z.string().default(""),
  notes: z.string().default(""),
});

/**
 * Project update payload
 */
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  shootDates: z.array(z.string()).optional(),
  briefUrl: z.string().optional(),
  notes: z.string().optional(),
});
