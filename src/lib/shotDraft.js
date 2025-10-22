import { Timestamp } from "firebase/firestore";
import { z } from "zod";

export const shotProductPayloadSchema = z.object({
  productId: z.string().min(1, "Missing product identifier"),
  productName: z.string().min(1, "Missing product name"),
  styleNumber: z.string().nullable().optional(),
  colourId: z.string().nullable().optional(),
  colourName: z.string().nullable().optional(),
  colourImagePath: z.string().nullable().optional(),
  thumbnailImagePath: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  sizeScope: z.enum(["all", "single", "pending"]),
  status: z.enum(["pending-size", "complete"]),
});

export const shotDraftSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
  type: z.string().trim().optional(),
  status: z.enum(["todo", "in_progress", "complete", "on_hold"]).default("todo"),
  date: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "Enter date as YYYY-MM-DD",
    }),
  locationId: z.string().optional(),
  projectId: z.string().trim().optional(),
  products: z.array(z.any()),
  talent: z.array(
    z.object({
      talentId: z.string().min(1),
      name: z.string().trim().min(1),
    })
  ),
  tags: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        color: z.string(),
      })
    )
    .optional(),
  referenceImagePath: z.string().optional(), // Storyboard/reference image path
});

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
  referenceImagePath: "",
};

export const toDateInputValue = (value) => {
  if (!value) return "";
  if (value instanceof Timestamp) {
    return value.toDate().toISOString().slice(0, 10);
  }
  if (value && typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate().toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return "";
};

export const parseDateToTimestamp = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Timestamp.fromDate(parsed);
};

export const mapProductForWrite = (product) => {
  const payload = {
    productId: product.familyId || product.productId || "",
    productName: (product.familyName || product.productName || "Product").trim(),
    styleNumber: product.styleNumber ?? null,
    colourId: product.colourId ?? null,
    colourName: product.colourName ?? null,
    colourImagePath: product.colourImagePath ?? null,
    thumbnailImagePath: product.thumbnailImagePath ?? null,
    size: product.size ?? null,
    sizeScope:
      product.sizeScope ||
      (product.status === "pending-size" ? "pending" : product.size ? "single" : "all"),
    status: product.status === "pending-size" ? "pending-size" : "complete",
  };
  return shotProductPayloadSchema.parse(payload);
};

export const extractProductIds = (products = []) => {
  const ids = new Set();
  products.forEach((product) => {
    const id = product.familyId || product.productId || product.productIdRef;
    if (id) ids.add(id);
  });
  return Array.from(ids);
};

export const mapTalentForWrite = (talentEntries = []) =>
  talentEntries
    .filter((entry) => entry && entry.talentId)
    .map((entry) => ({ talentId: entry.talentId, name: entry.name }));
