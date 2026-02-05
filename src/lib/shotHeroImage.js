export function getShotHeroImage(shot) {
  if (!shot || typeof shot !== "object") return null;

  const looks = Array.isArray(shot.looks) ? shot.looks : [];
  for (const look of looks) {
    const references = Array.isArray(look?.references) ? look.references : [];
    if (references.length === 0) continue;

    const displayId = typeof look?.displayImageId === "string" ? look.displayImageId : null;
    const displayRef = displayId ? references.find((ref) => ref?.id === displayId) : null;
    const candidate = displayRef || references[0] || null;
    const src = candidate?.downloadURL || candidate?.path || "";
    if (typeof src === "string" && src.trim()) {
      return {
        src,
        kind: "look-reference",
        id: candidate?.id || null,
      };
    }
  }

  const attachments = Array.isArray(shot.attachments) ? shot.attachments : [];
  if (attachments.length > 0) {
    const primary = attachments.find((att) => att?.isPrimary) || attachments[0] || null;
    const src = primary?.downloadURL || primary?.path || "";
    if (typeof src === "string" && src.trim()) {
      return {
        src,
        kind: "attachment",
        id: primary?.id || null,
      };
    }
  }

  // Legacy: only render if this is already a URL (avoid introducing storage reads here).
  const legacyUrl =
    typeof shot.referenceImageUrl === "string"
      ? shot.referenceImageUrl
      : typeof shot.referenceImagePath === "string" && shot.referenceImagePath.startsWith("http")
        ? shot.referenceImagePath
        : "";
  if (legacyUrl) {
    return { src: legacyUrl, kind: "legacy", id: null };
  }

  return null;
}

