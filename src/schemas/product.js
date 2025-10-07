/**
 * Product validation schemas (Product Families and SKUs)
 */
import { z } from "zod";
import {
  docIdSchema,
  timestampSchema,
  userIdSchema,
  genderSchema,
  productStatusSchema,
  softDeleteSchema,
  auditFieldsSchema,
  storagePathSchema,
  stringArraySchema,
  notesSchema,
} from "./common.js";

/**
 * Product SKU (colorway) schema
 */
export const productSkuSchema = z.object({
  id: docIdSchema.optional(),
  colorName: z.string().min(1, "Color name is required").max(100),
  skuCode: z.string().max(100).nullable().optional(),
  sizes: stringArraySchema,
  status: productStatusSchema.default("active"),
  archived: z.boolean().default(false),
  imagePath: storagePathSchema,
  ...softDeleteSchema.shape,
  ...auditFieldsSchema.shape,
});

/**
 * Product SKU creation payload (for forms)
 */
export const createProductSkuSchema = z.object({
  colorName: z.string().min(1, "Color name is required").max(100),
  skuCode: z.string().max(100).default(""),
  sizes: stringArraySchema,
  status: productStatusSchema.default("active"),
  archived: z.boolean().default(false),
  imageFile: z.any().nullable().optional(), // File object
  imagePath: storagePathSchema,
  removeImage: z.boolean().optional(),
});

/**
 * Product Family schema
 */
export const productFamilySchema = z.object({
  id: docIdSchema.optional(),
  styleName: z.string().min(1, "Style name is required").max(200),
  styleNumber: z.string().max(100).nullable().optional(),
  previousStyleNumber: z.string().max(100).nullable().optional(),
  gender: genderSchema,
  status: productStatusSchema.default("active"),
  archived: z.boolean().default(false),
  notes: notesSchema,
  headerImagePath: storagePathSchema,
  thumbnailImagePath: storagePathSchema,
  sizes: stringArraySchema,

  // Aggregate fields (calculated from SKUs)
  skuCount: z.number().int().min(0).default(0),
  activeSkuCount: z.number().int().min(0).default(0),
  skuCodes: stringArraySchema,
  colorNames: stringArraySchema,
  sizeOptions: stringArraySchema,
  shotIds: stringArraySchema,

  ...softDeleteSchema.shape,
  ...auditFieldsSchema.shape,
});

/**
 * Product Family creation payload (for forms)
 */
export const createProductFamilySchema = z.object({
  family: z.object({
    styleName: z.string().min(1, "Style name is required").max(200),
    styleNumber: z.string().max(100).default(""),
    previousStyleNumber: z.string().max(100).default(""),
    gender: genderSchema.default(""),
    status: productStatusSchema.default("active"),
    archived: z.boolean().default(false),
    notes: z.string().default(""),
    sizes: stringArraySchema,
    headerImageFile: z.any().nullable().optional(), // File object
    thumbnailImageFile: z.any().nullable().optional(), // File object
  }),
  skus: z.array(createProductSkuSchema).min(1, "At least one SKU is required"),
});

/**
 * Product Family update payload
 */
export const updateProductFamilySchema = z.object({
  styleName: z.string().min(1, "Style name is required").max(200).optional(),
  styleNumber: z.string().max(100).optional(),
  previousStyleNumber: z.string().max(100).optional(),
  gender: genderSchema,
  status: productStatusSchema.optional(),
  archived: z.boolean().optional(),
  notes: z.string().optional(),
  sizes: stringArraySchema.optional(),
  headerImageFile: z.any().nullable().optional(),
  thumbnailImageFile: z.any().nullable().optional(),
});
