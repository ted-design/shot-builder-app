import { doc, setDoc } from "firebase/firestore";
import { deleteDoc } from "firebase/firestore";
import { uploadImageFile, deleteImageByPath } from "./firebase";
import { colorSwatchPath } from "./paths";
import { normalizeHexColor } from "./colorExtraction";

export const normalizeColorName = (value) => {
  if (!value) return "";
  return value.toString().trim().toLowerCase();
};

export const buildColorKey = (value) => {
  const normalized = normalizeColorName(value);
  if (!normalized) return "color";
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "color";
};

export const indexColorSwatches = (swatches = []) => {
  const byKey = new Map();
  const byName = new Map();

  swatches.forEach((swatch) => {
    const colorKey = swatch.colorKey || buildColorKey(swatch.name || swatch.id || "");
    const normalizedName = normalizeColorName(swatch.name || swatch.label || "");
    const entry = {
      ...swatch,
      colorKey,
      normalizedName,
    };

    byKey.set(colorKey, entry);
    if (normalizedName) {
      byName.set(normalizedName, entry);
    }
    (swatch.aliases || []).forEach((alias) => {
      const aliasKey = normalizeColorName(alias);
      if (aliasKey && !byName.has(aliasKey)) {
        byName.set(aliasKey, entry);
      }
    });
  });

  return { byKey, byName };
};

export const findPaletteMatch = (color, paletteIndex) => {
  if (!paletteIndex) return null;
  const { byKey, byName } = paletteIndex;
  if (color?.colorKey && byKey?.has(color.colorKey)) {
    return byKey.get(color.colorKey);
  }

  const normalizedName = normalizeColorName(color?.colorName || color?.label || color?.name);
  if (normalizedName && byName?.has(normalizedName)) {
    return byName.get(normalizedName);
  }

  return null;
};

/**
 * Resolve a swatch for a SKU using palette first, then SKU hex, then optional extractor.
 * @param {Object} sku - SKU data ({ colorKey, colorName, hexColor, imagePath })
 * @param {Object} paletteIndex - { byKey, byName }
 * @param {Object} options
 * @param {(sku: any) => Promise<string|null>} [options.extractFallback] - async extractor when no palette/hex present
 * @returns {Promise<{ hexColor: string, swatchImagePath: string|null, source: string, paletteMatch?: any }>}
 */
export const resolveSwatchForSku = async (sku, paletteIndex, { extractFallback } = {}) => {
  const paletteMatch = findPaletteMatch(sku, paletteIndex);
  if (paletteMatch) {
    return {
      hexColor: paletteMatch.hexColor || sku.hexColor || "#CCCCCC",
      swatchImagePath: paletteMatch.swatchImagePath || null,
      source: "palette",
      paletteMatch,
    };
  }

  if (sku.hexColor) {
    return { hexColor: sku.hexColor, swatchImagePath: null, source: "sku" };
  }

  if (typeof extractFallback === "function") {
    const extracted = await extractFallback(sku);
    if (extracted) {
      return { hexColor: extracted, swatchImagePath: null, source: "extracted" };
    }
  }

  return { hexColor: "#CCCCCC", swatchImagePath: null, source: "fallback" };
};

/**
 * Create or update a palette swatch entry.
 * If swatchImageFile is provided it will be uploaded to storage under colorSwatches/{colorKey}.
 */
export const upsertColorSwatch = async ({
  db,
  clientId,
  name,
  hexColor,
  aliases = [],
  swatchImageFile,
  swatchImagePath,
}) => {
  if (!db) throw new Error("Firestore db is required");
  if (!clientId) throw new Error("clientId is required");

  const trimmedName = (name || "").trim();
  if (!trimmedName) throw new Error("Colour name is required to save a swatch");

  const colorKey = buildColorKey(trimmedName);
  const normalizedName = normalizeColorName(trimmedName);
  const timestamp = Date.now();
  const payload = {
    name: trimmedName,
    colorKey,
    normalizedName,
    aliases: Array.isArray(aliases) ? aliases.filter(Boolean) : [],
    updatedAt: timestamp,
  };

  const hex = hexColor ? normalizeHexColor(hexColor) : null;
  if (hex) {
    payload.hexColor = hex;
  }
  if (swatchImagePath) {
    payload.swatchImagePath = swatchImagePath;
  }

  if (swatchImageFile) {
    const result = await uploadImageFile(swatchImageFile, {
      folder: "colorSwatches",
      id: colorKey,
      filename: `${colorKey}.webp`,
      optimize: false, // image is already compressed in the form layer
    });
    payload.swatchImagePath = result.path;
  }

  const swatchRef = doc(db, ...colorSwatchPath(colorKey, clientId));
  await setDoc(swatchRef, payload, { merge: true });

  return { id: swatchRef.id, ...payload };
};

export const deleteColorSwatch = async ({ db, clientId, colorKey, swatchImagePath }) => {
  if (!db) throw new Error("Firestore db is required");
  if (!clientId) throw new Error("clientId is required");
  if (!colorKey) throw new Error("colorKey is required to delete a swatch");

  if (swatchImagePath) {
    await deleteImageByPath(swatchImagePath).catch(() => {});
  }

  await deleteDoc(doc(db, ...colorSwatchPath(colorKey, clientId)));
};
