import React, { useCallback, useMemo, useRef, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import ShotEditModal from "../../shots/ShotEditModal";
import { db } from "../../../lib/firebase";
import { productFamilySkusPath } from "../../../lib/paths";
import { toast } from "../../../lib/toast";
import { useUpdateShot } from "../../../hooks/useFirestoreMutations";
import {
  extractProductIds,
  mapProductForWrite,
  mapTalentForWrite,
  parseDateToTimestamp,
  toDateInputValue,
} from "../../../lib/shotDraft";

function normaliseShotDraft(shot) {
  if (!shot) return null;
  return {
    ...shot,
    date: toDateInputValue(shot.date),
    type: shot.type || "",
    description: typeof shot.description === "string" ? shot.description : shot.description || "",
    locationId: shot.locationId || "",
    products: Array.isArray(shot.products) ? shot.products : [],
    talent: Array.isArray(shot.talent) ? shot.talent : [],
    tags: Array.isArray(shot.tags) ? shot.tags : [],
    attachments: Array.isArray(shot.attachments) ? shot.attachments : [],
    referenceImagePath: shot.referenceImagePath || "",
  };
}

function createShotProduct(selection, previous) {
  const family = selection?.family;
  const colour = selection?.colour;
  const base = previous && typeof previous === "object" ? previous : {};

  const familyId = family?.id || base.productId || base.familyId || "";
  const familyName =
    family?.familyName ||
    family?.productName ||
    family?.name ||
    base.familyName ||
    base.productName ||
    "Product";

  const colourId = colour?.id || base.colourId || null;
  const colourName = colour?.colorName || colour?.colourName || base.colourName || null;
  const colourImagePath = colour?.imagePath || base.colourImagePath || null;
  const thumbnailImagePath =
    family?.thumbnailImagePath ||
    family?.imagePath ||
    colourImagePath ||
    base.thumbnailImagePath ||
    null;

  return mapProductForWrite({
    ...base,
    productId: familyId,
    productName: familyName,
    styleNumber: family?.styleNumber || base.styleNumber || null,
    colourId,
    colourName,
    colourImagePath,
    thumbnailImagePath,
    size: selection?.size ?? base.size ?? null,
    sizeScope: selection?.sizeScope || base.sizeScope || "all",
    status: selection?.status || base.status || "complete",
  });
}

export default function ScheduleShotEditorModal({
  open,
  onClose,
  clientId,
  projectId,
  shot,
  families = [],
  locations = [],
  talentOptions = [],
}) {
  const [draft, setDraft] = useState(() => normaliseShotDraft(shot));
  const cacheRef = useRef(new Map());

  const updateShot = useUpdateShot(clientId, projectId, {
    shotName: draft?.name || shot?.name || "",
    onSuccess: () => {
      toast.success({ title: "Shot saved" });
    },
  });

  React.useEffect(() => {
    if (!open) return;
    setDraft(normaliseShotDraft(shot));
  }, [open, shot]);

  const loadFamilyDetails = useCallback(
    async (familyId) => {
      if (!clientId || !familyId) return { colours: [], sizes: [] };
      if (cacheRef.current.has(familyId)) {
        return cacheRef.current.get(familyId);
      }

      const skusPath = productFamilySkusPath(familyId, clientId);
      const snapshot = await getDocs(
        query(collection(db, ...skusPath), orderBy("colorName", "asc"))
      );
      const colours = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      const sizes = families.find((family) => family.id === familyId)?.sizes || [];
      const details = { colours, sizes };
      cacheRef.current.set(familyId, details);
      return details;
    },
    [clientId, families]
  );

  const handleDraftChange = useCallback((patch) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const handleSave = useCallback(async () => {
    if (!draft?.id) return;
    const products = Array.isArray(draft.products) ? draft.products.map(mapProductForWrite) : [];
    const updates = {
      name: draft.name || "",
      type: draft.type || "",
      description: draft.description || "",
      status: draft.status || "todo",
      date: draft.date ? parseDateToTimestamp(draft.date) : null,
      locationId: draft.locationId || "",
      products,
      productIds: extractProductIds(products),
      talent: mapTalentForWrite(draft.talent),
      tags: Array.isArray(draft.tags) ? draft.tags : [],
      attachments: Array.isArray(draft.attachments) ? draft.attachments : [],
      referenceImagePath: draft.referenceImagePath || "",
      projectId: draft.projectId || projectId || "",
    };

    try {
      await updateShot.mutateAsync({ shotId: draft.id, updates });
      onClose?.();
    } catch (error) {
      // useUpdateShot already toasts
    }
  }, [draft, projectId, updateShot, onClose]);

  const modalHeading = useMemo(() => {
    const name = draft?.name || shot?.name;
    return name ? `Edit Shot: ${name}` : "Edit Shot";
  }, [draft?.name, shot?.name]);

  return (
    <ShotEditModal
      open={open}
      heading={modalHeading}
      shotName={draft?.name || ""}
      draft={draft}
      onChange={handleDraftChange}
      onClose={onClose}
      onSubmit={handleSave}
      isSaving={updateShot.isPending}
      submitLabel="Save"
      savingLabel="Saving…"
      families={families}
      loadFamilyDetails={loadFamilyDetails}
      createProduct={createShotProduct}
      allowProductCreation={false}
      locations={locations}
      talentOptions={talentOptions}
      projects={[]}
      currentProjectId={projectId}
      shotId={draft?.id || null}
    />
  );
}

