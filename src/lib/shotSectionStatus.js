import { DEFAULT_SHOT_STATUS, normaliseShotStatus } from "./shotStatus";
import { toDateInputValue } from "./shotDraft";

export const EDITOR_SECTION_IDS = ["basics", "creative-logistics"];

export const createInitialSectionStatuses = () =>
  EDITOR_SECTION_IDS.reduce((accumulator, section) => {
    accumulator[section] = { state: "saved" };
    return accumulator;
  }, {});

export const cloneShotDraft = (draft = {}) => ({
  ...draft,
  products: Array.isArray(draft.products) ? draft.products.map((product) => ({ ...product })) : [],
  talent: Array.isArray(draft.talent) ? draft.talent.map((entry) => ({ ...entry })) : [],
  tags: Array.isArray(draft.tags) ? draft.tags.map((tag) => ({ ...tag })) : [],
  referenceImageCrop: draft.referenceImageCrop ? { ...draft.referenceImageCrop } : null,
  referenceImageFile: null,
  date: toDateInputValue(draft.date),
});

const normaliseStringValue = (value) => (value == null ? "" : String(value));

const normaliseDateValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate().toISOString().slice(0, 10);
  }
  return "";
};

const buildProductSortKey = (product) =>
  [product.familyId || product.productId || product.id || "", product.colourId || "", product.size || "", product.sizeScope || "", product.status || ""]
    .map((part) => normaliseStringValue(part))
    .join("::");

const normaliseProductsForCompare = (products = []) =>
  Array.isArray(products)
    ? products
        .map((product) => ({
          id: product.id ?? null,
          familyId: product.familyId ?? product.productId ?? null,
          productId: product.productId ?? null,
          colourId: product.colourId ?? null,
          colourName: product.colourName ?? null,
          size: product.size ?? null,
          sizeScope: product.sizeScope ?? null,
          status: product.status ?? null,
          skuCode: product.skuCode ?? null,
        }))
        .sort((a, b) => buildProductSortKey(a).localeCompare(buildProductSortKey(b)))
    : [];

const normaliseTalentForCompare = (talent = []) =>
  Array.isArray(talent)
    ? talent
        .filter((entry) => entry && entry.talentId)
        .map((entry) => ({
          talentId: entry.talentId,
          name: normaliseStringValue(entry.name),
        }))
        .sort((a, b) => a.talentId.localeCompare(b.talentId))
    : [];

const normaliseTagsForCompare = (tags = []) =>
  Array.isArray(tags)
    ? tags
        .filter((tag) => tag && tag.id)
        .map((tag) => ({ id: tag.id, label: normaliseStringValue(tag.label), color: normaliseStringValue(tag.color) }))
        .sort((a, b) => a.id.localeCompare(b.id))
    : [];

const normaliseCropForCompare = (crop) => {
  if (!crop) return "";
  return JSON.stringify({ x: typeof crop.x === "number" ? crop.x : 50, y: typeof crop.y === "number" ? crop.y : 50 });
};

const listsAreEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const hasBasicsChanges = (draft = {}, baseline = {}) => {
  const draftStatus = normaliseShotStatus(draft.status ?? DEFAULT_SHOT_STATUS);
  const baselineStatus = normaliseShotStatus(baseline.status ?? DEFAULT_SHOT_STATUS);
  if (draftStatus !== baselineStatus) return true;
  if (normaliseStringValue(draft.name) !== normaliseStringValue(baseline.name)) return true;
  if (normaliseStringValue(draft.type) !== normaliseStringValue(baseline.type)) return true;
  if (normaliseDateValue(draft.date) !== normaliseDateValue(baseline.date)) return true;
  if (normaliseStringValue(draft.locationId) !== normaliseStringValue(baseline.locationId)) return true;

  // Include attachments in basics section
  if (Boolean(draft.referenceImageFile) !== Boolean(baseline.referenceImageFile)) return true;
  if (normaliseStringValue(draft.referenceImagePath) !== normaliseStringValue(baseline.referenceImagePath)) return true;
  if (normaliseCropForCompare(draft.referenceImageCrop) !== normaliseCropForCompare(baseline.referenceImageCrop)) return true;

  // Check attachments array
  const draftAttachments = Array.isArray(draft.attachments) ? draft.attachments : [];
  const baselineAttachments = Array.isArray(baseline.attachments) ? baseline.attachments : [];
  if (draftAttachments.length !== baselineAttachments.length) return true;
  if (JSON.stringify(draftAttachments) !== JSON.stringify(baselineAttachments)) return true;

  return false;
};

const hasCreativeLogisticsChanges = (draft = {}, baseline = {}) => {
  // Check creative changes (notes/description)
  if (normaliseStringValue(draft.description) !== normaliseStringValue(baseline.description)) {
    return true;
  }

  // Check logistics changes (products, talent, tags)
  if (!listsAreEqual(normaliseProductsForCompare(draft.products), normaliseProductsForCompare(baseline.products))) {
    return true;
  }
  if (!listsAreEqual(normaliseTalentForCompare(draft.talent), normaliseTalentForCompare(baseline.talent))) {
    return true;
  }
  if (!listsAreEqual(normaliseTagsForCompare(draft.tags), normaliseTagsForCompare(baseline.tags))) {
    return true;
  }

  return false;
};

export const buildSectionDiffMap = (draft = {}, baseline = {}) => ({
  basics: hasBasicsChanges(draft, baseline),
  "creative-logistics": hasCreativeLogisticsChanges(draft, baseline),
});

export const deriveSectionStatuses = (draft, baseline, previousStatuses = null) => {
  const diffMap = buildSectionDiffMap(draft, baseline);
  return EDITOR_SECTION_IDS.reduce((accumulator, section) => {
    const previous = previousStatuses?.[section] || null;
    if (previous?.state === "saving") {
      accumulator[section] = previous;
      return accumulator;
    }
    if (previous?.state === "error") {
      accumulator[section] = diffMap[section] ? { state: "pending" } : { state: "saved" };
      return accumulator;
    }
    accumulator[section] = diffMap[section] ? { state: "pending" } : { state: "saved" };
    return accumulator;
  }, {});
};

export const markSectionsForState = (currentStatuses, draft, baseline, nextState, extra = {}) => {
  const diffMap = buildSectionDiffMap(draft, baseline);
  const next = { ...currentStatuses };
  EDITOR_SECTION_IDS.forEach((section) => {
    if (diffMap[section]) {
      next[section] = { state: nextState, ...extra };
    }
  });
  return next;
};
