// src/lib/shotProductsForPull.js
//
// Pull generation needs to treat product assignments on a shot as a single,
// canonical set even though legacy data may live in multiple fields:
// - shot.products (legacy/direct)
// - shot.looks[].products (workspace editor)
// - shot.productIds (legacy ID-only fallback)
//
// This helper merges those sources without any additional Firestore reads.

const normaliseSizeScope = (product) => {
  if (!product || typeof product !== "object") return "all";
  const raw = product.sizeScope;
  if (raw === "all" || raw === "single" || raw === "pending") return raw;
  if (product.status === "pending-size") return "pending";
  if (product.size) return "single";
  return "all";
};

const resolveFamilyFromMap = (familyById, familyId) => {
  if (!familyById || !familyId) return null;
  if (typeof familyById.get === "function") return familyById.get(familyId) || null;
  return familyById[familyId] || null;
};

const buildDedupKey = (product) => {
  const familyId = product?.familyId || product?.productId || product?.productIdRef || "";
  const colourId = product?.colourId || product?.colourwayId || "";
  const scope = normaliseSizeScope(product);
  const size = scope === "single" ? (product?.size || "") : scope;
  return `${familyId}::${colourId}::${scope}::${size}`;
};

export function extractShotProductsForPull(shot, { familyById = null } = {}) {
  if (!shot || typeof shot !== "object") return [];

  const merged = [];
  const seen = new Set();

  const add = (product) => {
    if (!product || typeof product !== "object") return;
    const familyId = product.familyId || product.productId || product.productIdRef || null;
    if (!familyId) return;
    const key = buildDedupKey(product);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(product);
  };

  // Source 1: shot.products (legacy/direct)
  if (Array.isArray(shot.products)) {
    shot.products.forEach(add);
  }

  // Source 2: shot.looks[].products (workspace editor)
  if (Array.isArray(shot.looks)) {
    shot.looks.forEach((look) => {
      if (!look || typeof look !== "object") return;
      if (!Array.isArray(look.products)) return;
      look.products.forEach(add);
    });
  }

  // Source 3: shot.productIds (legacy ID-only) — only if no richer sources exist
  if (merged.length === 0 && Array.isArray(shot.productIds)) {
    shot.productIds.forEach((rawId) => {
      const familyId = typeof rawId === "string" && rawId.trim() ? rawId.trim() : null;
      if (!familyId) return;
      const family = resolveFamilyFromMap(familyById, familyId);
      const familyName = family?.styleName || family?.name || "Unknown Product";
      add({
        familyId,
        familyName,
        productId: familyId,
        productName: familyName,
        colourId: null,
        colourName: "Any colour",
        size: null,
        sizeScope: "all",
      });
    });
  }

  return merged;
}

