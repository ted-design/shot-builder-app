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
  notesArraySchema,
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
  hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format").nullable().optional(),
  ...softDeleteSchema.shape,
  ...auditFieldsSchema.shape,
});

/**
 * Product SKU creation payload (for forms)
 */
export const createProductSkuSchema = z.object({
  id: z.string().nullable().optional(), // Existing SKU ID for updates
  localId: z.string().optional(), // Local form ID for tracking
  colorName: z.string().min(1, "Color name is required").max(100),
  skuCode: z.string().max(100).default(""),
  sizes: stringArraySchema,
  status: productStatusSchema.default("active"),
  archived: z.boolean().default(false),
  imageFile: z.any().nullable().optional(), // File object
  imagePath: storagePathSchema,
  removeImage: z.boolean().optional().default(false),
  hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format").nullable().optional(),
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
  productType: z.string().max(50).nullable().optional(), // "tops", "bottoms", "accessories"
  productSubcategory: z.string().max(50).nullable().optional(), // "tshirts", "pants", "hats", etc.
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
    previousStyleNumber: z.string().max(100).nullable().optional().default(""),
    gender: genderSchema.default("unisex"),
    productType: z.string().max(50).nullable().optional().default(null),
    productSubcategory: z.string().max(50).nullable().optional().default(null),
    status: productStatusSchema.default("active"),
    archived: z.boolean().default(false),
    notes: notesArraySchema,
    sizes: stringArraySchema,
    // Image file uploads
    headerImageFile: z.any().nullable().optional(),
    thumbnailImageFile: z.any().nullable().optional(),
    // Image removal flags
    removeHeaderImage: z.boolean().optional().default(false),
    removeThumbnailImage: z.boolean().optional().default(false),
    // Current image paths (for updates)
    currentHeaderImagePath: storagePathSchema,
    currentThumbnailImagePath: storagePathSchema,
  }),
  skus: z.array(createProductSkuSchema).min(1, "At least one SKU is required"),
  removedSkuIds: z.array(z.string()).optional().default([]),
});

/**
 * Product Family update payload
 */
export const updateProductFamilySchema = z.object({
  styleName: z.string().min(1, "Style name is required").max(200).optional(),
  styleNumber: z.string().max(100).optional(),
  previousStyleNumber: z.string().max(100).optional(),
  gender: genderSchema,
  productType: z.string().max(50).nullable().optional(),
  productSubcategory: z.string().max(50).nullable().optional(),
  status: productStatusSchema.optional(),
  archived: z.boolean().optional(),
  notes: z.string().optional(),
  sizes: stringArraySchema.optional(),
  headerImageFile: z.any().nullable().optional(),
  thumbnailImageFile: z.any().nullable().optional(),
});
