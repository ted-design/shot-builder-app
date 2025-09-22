import { addDoc, collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { uploadImageFile } from "./firebase";
import { productFamiliesPath, productFamilySkusPath } from "./paths";

const buildSkuAggregates = (skus, familySizes = []) => {
  const skuCodes = new Set();
  const colorNames = new Set();
  const sizes = new Set((familySizes || []).filter(Boolean));
  let activeSkuCount = 0;

  (skus || []).forEach((sku) => {
    if (sku.skuCode) skuCodes.add(sku.skuCode);
    if (sku.colorName) colorNames.add(sku.colorName);
    (sku.sizes || []).forEach((size) => size && sizes.add(size));
    if (sku.status === "active") activeSkuCount += 1;
  });

  return {
    skuCodes: Array.from(skuCodes),
    colorNames: Array.from(colorNames),
    sizeOptions: Array.from(sizes),
    skuCount: (skus || []).length,
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
      const result = await uploadImageFile(sku.imageFile, {
        folder: `productFamilies/${familyId}/skus`,
        id: skuRef.id,
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

export { buildSkuAggregates };
