import { addDoc, collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { uploadImageFile } from "./firebase";
import { productFamiliesPath, productFamilyPath, productFamilySkusPath } from "./paths";
import { createProductFamilySchema, createProductSkuSchema } from "../schemas/index.js";

/**
 * Formats a product image filename based on product metadata
 * Format: StyleNumber_StyleName_Colour.webp
 * Example: UM2025-1026_MerinoShortSleeveHenley_Black.webp
 *
 * @param {string} styleNumber - Product style number
 * @param {string} styleName - Product style name
 * @param {string} colorName - SKU color name
 * @returns {string} Formatted filename
 */
const formatProductImageFilename = (styleNumber, styleName, colorName) => {
  // Sanitize a string for use in filename: remove special chars, convert to PascalCase
  const sanitize = (str) => {
    if (!str) return '';
    return str
      .trim()
      // Remove special characters except hyphens and spaces
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      // Convert to PascalCase by capitalizing first letter of each word and removing spaces
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  };

  const parts = [];

  // Style number: keep as-is (with hyphens), just remove unsafe chars
  if (styleNumber) {
    parts.push(styleNumber.trim().replace(/[^a-zA-Z0-9-]/g, ''));
  }

  // Style name: convert to PascalCase
  if (styleName) {
    parts.push(sanitize(styleName));
  }

  // Color name: convert to PascalCase
  if (colorName) {
    parts.push(sanitize(colorName));
  }

  // If we have no parts, return a timestamp-based fallback
  if (parts.length === 0) {
    return `product-${Date.now()}.webp`;
  }

  return `${parts.join('_')}.webp`;
};

const buildSkuAggregates = (skus, familySizes = []) => {
  const skuCodes = new Set();
  const colorNames = new Set();
  const sizes = new Set((familySizes || []).filter(Boolean));
  let activeSkuCount = 0;

  const activeSkus = (skus || []).filter((sku) => !sku.deleted);
  activeSkus.forEach((sku) => {
    if (sku.skuCode) skuCodes.add(sku.skuCode);
    if (sku.colorName) colorNames.add(sku.colorName);
    (sku.sizes || []).forEach((size) => size && sizes.add(size));
    if (sku.status === "active") activeSkuCount += 1;
  });

  return {
    skuCodes: Array.from(skuCodes),
    colorNames: Array.from(colorNames),
    sizeOptions: Array.from(sizes),
    skuCount: activeSkus.length,
    activeSkuCount,
  };
};

export const genderLabel = (value) => {
  switch ((value || "").toLowerCase()) {
    case "men":
    case "mens":
      return "Men's";
    case "women":
    case "womens":
      return "Women's";
    case "unisex":
      return "Unisex";
    case "other":
      return "Other";
    default:
      return "Unspecified";
  }
};

export const createProductFamily = async ({ db, clientId, payload, userId }) => {
  if (!db) throw new Error("Database instance is required to create a product.");
  if (!clientId) throw new Error("Missing client identifier for product creation.");

  // Validate payload
  try {
    createProductFamilySchema.parse(payload);
  } catch (error) {
    throw new Error(`Invalid product data: ${error.errors.map(e => e.message).join(", ")}`);
  }

  const now = Date.now();
  const familySizes = Array.isArray(payload.family?.sizes) ? payload.family.sizes : [];
  const aggregates = buildSkuAggregates(payload.skus, familySizes);
  const familiesCollection = collection(db, ...productFamiliesPath(clientId));
  const baseData = {
    styleName: payload.family?.styleName,
    styleNumber: payload.family?.styleNumber,
    previousStyleNumber: payload.family?.previousStyleNumber,
    gender: payload.family?.gender,
    status: payload.family?.status,
    archived: payload.family?.archived,
    notes: payload.family?.notes,
    headerImagePath: null,
    thumbnailImagePath: null,
    sizes: familySizes,
    skuCount: aggregates.skuCount,
    activeSkuCount: aggregates.activeSkuCount,
    skuCodes: aggregates.skuCodes,
    colorNames: aggregates.colorNames,
    sizeOptions: aggregates.sizeOptions,
    shotIds: [],
    deleted: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: userId || null,
    updatedBy: userId || null,
  };

  const familyRef = await addDoc(familiesCollection, baseData);
  const familyId = familyRef.id;
  let thumbnailPath = null;

  if (payload.family?.thumbnailImageFile) {
    const { path } = await uploadImageFile(payload.family.thumbnailImageFile, {
      folder: "productFamilies",
      id: `${familyId}/thumbnail`,
    });
    thumbnailPath = path;
    await updateDoc(familyRef, {
      thumbnailImagePath: path,
      updatedAt: Date.now(),
      updatedBy: userId || null,
    });
  }

  if (payload.family?.headerImageFile) {
    const { path } = await uploadImageFile(payload.family.headerImageFile, {
      folder: "productFamilies",
      id: familyId,
    });
    await updateDoc(familyRef, {
      headerImagePath: path,
      updatedAt: Date.now(),
      updatedBy: userId || null,
    });
  }

  const skuCollection = collection(db, ...productFamilySkusPath(familyId, clientId));
  let fallbackImagePath = null;

  for (const sku of payload.skus || []) {
    const skuRef = doc(skuCollection);
    let imagePath = sku.imagePath || null;

    if (sku.imageFile) {
      // Generate formatted filename: StyleNumber_StyleName_Colour.webp
      const filename = formatProductImageFilename(
        payload.family?.styleNumber,
        payload.family?.styleName,
        sku.colorName
      );

      const result = await uploadImageFile(sku.imageFile, {
        folder: `productFamilies/${familyId}/skus`,
        id: skuRef.id,
        filename,
      });
      imagePath = result.path;
    }

    if (!fallbackImagePath && imagePath && !sku.removeImage) {
      fallbackImagePath = imagePath;
    }

    await setDoc(skuRef, {
      colorName: sku.colorName,
      skuCode: sku.skuCode,
      sizes: sku.sizes,
      status: sku.status,
      archived: sku.archived,
      imagePath,
      deleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: userId || null,
      updatedBy: userId || null,
    });
  }

  if (!thumbnailPath && fallbackImagePath) {
    await updateDoc(familyRef, {
      thumbnailImagePath: fallbackImagePath,
      updatedAt: Date.now(),
      updatedBy: userId || null,
    });
  }

  return familyId;
};

export const createProductColourway = async ({
  db,
  clientId,
  familyId,
  payload,
  userId,
  family,
  existingSkus = [],
}) => {
  if (!db) throw new Error("Database instance is required to create a colourway.");
  if (!clientId) throw new Error("Missing client identifier for colourway creation.");
  if (!familyId) throw new Error("Product family identifier is required.");

  // Validate payload
  try {
    createProductSkuSchema.parse(payload);
  } catch (error) {
    throw new Error(`Invalid SKU data: ${error.errors.map(e => e.message).join(", ")}`);
  }

  const colourName = (payload?.colorName || "").trim();
  if (!colourName) {
    throw new Error("Colour name is required.");
  }

  const skuCode = (payload?.skuCode || "").trim();
  const status = payload?.status || "active";
  const familySizes = Array.isArray(family?.sizes)
    ? family.sizes.filter(Boolean)
    : Array.isArray(payload?.sizes)
    ? payload.sizes.filter(Boolean)
    : [];
  const sizes = Array.isArray(payload?.sizes)
    ? payload.sizes.filter(Boolean)
    : familySizes;

  const now = Date.now();
  const skuCollection = collection(db, ...productFamilySkusPath(familyId, clientId));
  const skuRef = doc(skuCollection);
  let imagePath = payload?.imagePath || null;

  if (payload?.imageFile) {
    // Generate formatted filename: StyleNumber_StyleName_Colour.webp
    const filename = formatProductImageFilename(
      family?.styleNumber,
      family?.styleName,
      colourName
    );

    const result = await uploadImageFile(payload.imageFile, {
      folder: `productFamilies/${familyId}/skus`,
      id: skuRef.id,
      filename,
    });
    imagePath = result.path;
  }

  const newSkuData = {
    colorName: colourName,
    skuCode,
    sizes,
    status,
    archived: status === "archived",
    imagePath,
    deleted: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: userId || null,
    updatedBy: userId || null,
  };

  await setDoc(skuRef, newSkuData);

  const aggregateSource = [
    ...existingSkus.map((sku) => ({
      colorName: sku.colorName,
      skuCode: sku.skuCode,
      sizes: Array.isArray(sku.sizes) && sku.sizes.length ? sku.sizes : familySizes,
      status: sku.status || "active",
    })),
    newSkuData,
  ];
  const aggregates = buildSkuAggregates(aggregateSource, familySizes);

  const familyRef = doc(db, ...productFamilyPath(familyId, clientId));
  const familyUpdates = {
    skuCount: aggregates.skuCount,
    activeSkuCount: aggregates.activeSkuCount,
    skuCodes: aggregates.skuCodes,
    colorNames: aggregates.colorNames,
    sizeOptions: aggregates.sizeOptions,
    updatedAt: now,
    updatedBy: userId || null,
  };

  if (!family?.thumbnailImagePath && !family?.headerImagePath && imagePath) {
    familyUpdates.thumbnailImagePath = imagePath;
  }

  await updateDoc(familyRef, familyUpdates);

  return { id: skuRef.id, ...newSkuData };
};

export { buildSkuAggregates, formatProductImageFilename };
