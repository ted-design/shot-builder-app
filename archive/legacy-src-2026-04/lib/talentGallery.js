import { nanoid } from "nanoid";
import { uploadImageFile } from "./firebase";

export const stripHtmlToText = (value) => {
  if (!value || typeof value !== "string") return "";
  const withNewlines = value.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p>/gi, "\n");
  const withoutTags = withNewlines.replace(/<[^>]+>/g, " ");
  return withoutTags.replace(/\s+/g, " ").trim();
};

const normaliseGalleryOrder = (items = []) =>
  (Array.isArray(items) ? items : [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((item, index) => ({ ...item, order: index }));

export const buildTalentGalleryUpdate = async (talentId, nextAttachments = [], previousAttachments = []) => {
  const sortedNext = normaliseGalleryOrder(nextAttachments);
  const previousMap = new Map((previousAttachments || []).map((item) => [item.id, item]));
  const finalGallery = [];

  for (let index = 0; index < sortedNext.length; index += 1) {
    const attachment = sortedNext[index];
    const description = (attachment.description || "").trim();
    const cropData = attachment.cropData || null;
    const id = attachment.id || nanoid();

    if (attachment.file) {
      const baseName = attachment.file.name || `image-${id}.jpg`;
      const safeName = baseName.replace(/\s+/g, "_");
      const { path, downloadURL } = await uploadImageFile(attachment.file, {
        folder: "talent",
        id: talentId,
        filename: `${id}-${safeName}`,
      });
      finalGallery.push({ id, path, downloadURL, description, cropData, order: index });
      continue;
    }

    const previous = previousMap.get(attachment.id) || {};
    const path = attachment.path || previous.path || null;
    const downloadURL = attachment.downloadURL || previous.downloadURL || path || null;
    if (!path && !downloadURL) continue;

    finalGallery.push({
      id,
      path,
      downloadURL,
      description,
      cropData: cropData ?? previous.cropData ?? null,
      order: index,
    });
  }

  const removed = (previousAttachments || []).filter((item) => !finalGallery.some((next) => next.id === item.id));
  return { finalGallery, removed };
};
