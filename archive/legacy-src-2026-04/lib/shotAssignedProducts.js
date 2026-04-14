const normaliseKeyPart = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return String(value);
};

const buildAssignedProductKey = (product) => {
  if (!product || typeof product !== "object") return "";

  const familyId = normaliseKeyPart(
    product.familyId ?? product.productId ?? product.productIdRef ?? product.skuId ?? product.id ?? ""
  );
  const colourId = normaliseKeyPart(product.colourId ?? product.colourwayId ?? product.colorId ?? "");

  const sizeScope = normaliseKeyPart(product.sizeScope ?? "");
  const sizeKey = sizeScope === "all" ? "all" : normaliseKeyPart(product.size ?? "");

  if (!familyId) return "";
  return `${familyId}::${colourId}::${sizeScope || "unknown"}::${sizeKey}`;
};

const collectAssignedProductsRaw = (shot) => {
  if (!shot || typeof shot !== "object") return [];

  const direct = Array.isArray(shot.products) ? shot.products : [];
  const looks = Array.isArray(shot.looks) ? shot.looks : [];
  const lookProducts = looks.flatMap((look) => (Array.isArray(look?.products) ? look.products : []));

  if (direct.length > 0 || lookProducts.length > 0) {
    return [...direct, ...lookProducts];
  }

  // Legacy fallback: ID-only references (only when no product objects exist)
  const productIds = Array.isArray(shot.productIds) ? shot.productIds : [];
  return productIds.map((familyId) => ({ familyId, colourId: null, sizeScope: "all", size: null }));
};

export const getShotAssignedProductsCount = (shot) => {
  const seen = new Set();
  const raw = collectAssignedProductsRaw(shot);
  let count = 0;

  raw.forEach((product) => {
    const key = buildAssignedProductKey(product);
    if (!key || seen.has(key)) return;
    seen.add(key);
    count += 1;
  });

  return count;
};

