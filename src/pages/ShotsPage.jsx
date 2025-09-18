// src/pages/ShotsPage.jsx (global shots version)
//
// This version centralises all shots into a single collection at
// `clients/{clientId}/shots` and adds a `projectId` field to each shot
// document.  When fetching shots we filter on the active project ID using
// a `where('projectId', '==', projectId)` clause.  This makes it easy to
// reassign shots to other projects—simply update the `projectId` field.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  getActiveProjectId,
  shotsPath as getShotsPath,
  productFamiliesPath,
  productFamilyPath,
  productFamilySkusPath,
  talentPath,
  locationsPath,
} from "../lib/paths";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import ShotProductsEditor from "../components/shots/ShotProductsEditor";
import TalentMultiSelect from "../components/shots/TalentMultiSelect";
import NotesEditor from "../components/shots/NotesEditor";
import { useAuth } from "../context/AuthContext";
import { canManageShots, ROLE } from "../lib/rbac";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { writeDoc } from "../lib/firestoreWrites";
import { toast } from "../lib/toast";
import { formatNotesForDisplay, sanitizeNotesHtml } from "../lib/sanitize";
import { z } from "zod";

const shotProductPayloadSchema = z.object({
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

const shotDraftSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
  type: z.string().trim().optional(),
  date: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "Enter date as YYYY-MM-DD",
    }),
  locationId: z.string().optional(),
  products: z.array(z.any()),
  talent: z.array(
    z.object({
      talentId: z.string().min(1),
      name: z.string().trim().min(1),
    })
  ),
});

const toDateInputValue = (value) => {
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

const parseDateToTimestamp = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Timestamp.fromDate(parsed);
};

const mapProductForWrite = (product) => {
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

const extractProductIds = (products = []) => {
  const ids = new Set();
  products.forEach((product) => {
    const id = product.familyId || product.productId || product.productIdRef;
    if (id) ids.add(id);
  });
  return Array.from(ids);
};

const mapTalentForWrite = (talentEntries = []) =>
  talentEntries
    .filter((entry) => entry && entry.talentId)
    .map((entry) => ({ talentId: entry.talentId, name: entry.name }));

const initialShotDraft = {
  name: "",
  description: "",
  type: "",
  date: "",
  locationId: "",
  products: [],
  talent: [],
};

export default function ShotsPage() {
  const [shots, setShots] = useState([]);
  const [draft, setDraft] = useState({ ...initialShotDraft });
  const [families, setFamilies] = useState([]);
  const [talent, setTalent] = useState([]);
  const [locations, setLocations] = useState([]);
  const [talentLoadError, setTalentLoadError] = useState(null);
  const [isCreatingShot, setIsCreatingShot] = useState(false);
  const projectId = getActiveProjectId();
  const { clientId, role: globalRole, user, claims } = useAuth();
  const userRole = globalRole || ROLE.VIEWER;
  const canEditShots = canManageShots(userRole);
  const currentShotsPath = useMemo(() => getShotsPath(clientId), [clientId]);
  const currentProductFamiliesPath = useMemo(() => productFamiliesPath(clientId), [clientId]);
  const currentTalentPath = useMemo(() => talentPath(clientId), [clientId]);
  const currentLocationsPath = useMemo(() => locationsPath(clientId), [clientId]);
  const productFamilyPathForClient = useCallback(
    (familyId) => productFamilyPath(familyId, clientId),
    [clientId]
  );
  const productFamilySkusPathForClient = useCallback(
    (familyId) => productFamilySkusPath(familyId, clientId),
    [clientId]
  );
  const buildAuthDebugInfo = useCallback(
    () => ({
      uid: user?.uid ?? null,
      claims: {
        role: claims?.role ?? null,
        clientId: claims?.clientId ?? null,
        orgId: claims?.orgId ?? null,
      },
    }),
    [user, claims]
  );

  const talentOptions = useMemo(
    () =>
      talent.map((entry) => {
        const name =
          entry.name ||
          [entry.firstName, entry.lastName].filter(Boolean).join(" ").trim() ||
          "Unnamed talent";
        return { talentId: entry.id, name };
      }),
    [talent]
  );

  const familyDetailCacheRef = useRef(new Map());
  const [editingShotProducts, setEditingShotProducts] = useState(null);

  // Helper to build references
  const collRef = (...segments) => collection(db, ...segments);
  const docRef = (...segments) => doc(db, ...segments);

  const toFamilyIdSet = (source) => {
    const ids = new Set();
    if (Array.isArray(source?.productIds)) {
      source.productIds.forEach((id) => id && ids.add(id));
    }
    if (Array.isArray(source?.products)) {
      source.products.forEach((item) => {
        const id = item?.familyId || item?.productId;
        if (id) ids.add(id);
      });
    }
    return ids;
  };

  /**
   * Keep related reverse indexes up to date when products/talent/locations change
   * on a shot.  When a shot references a product, for example, we also add the
   * shot ID to that product's `shotIds` array.  When removing a reference we
   * remove the shot ID from the relevant document.  Errors are caught and
   * ignored so that missing documents don't break the operation.
   */
  async function updateReverseIndexes({ shotId, before, after }) {
    // Products
    const prevP = toFamilyIdSet(before);
    const nextP = toFamilyIdSet(after);
    const addsP = [...nextP].filter((id) => !prevP.has(id));
    const remsP = [...prevP].filter((id) => !nextP.has(id));
    await Promise.all(
      addsP.map((id) =>
        updateDoc(docRef(...productFamilyPathForClient(id)), { shotIds: arrayUnion(shotId) }).catch(
          () => {}
        )
      )
    );
    await Promise.all(
      remsP.map((id) =>
        updateDoc(docRef(...productFamilyPathForClient(id)), { shotIds: arrayRemove(shotId) }).catch(
          () => {}
        )
      )
    );
    // Talent
    const prevT = new Set(before.talentIds || []);
    const nextT = new Set(after.talentIds || []);
    const addsT = [...nextT].filter((id) => !prevT.has(id));
    const remsT = [...prevT].filter((id) => !nextT.has(id));
    await Promise.all(
      addsT.map((id) =>
        updateDoc(docRef(...currentTalentPath, id), { shotIds: arrayUnion(shotId) }).catch(
          () => {}
        )
      )
    );
    await Promise.all(
      remsT.map((id) =>
        updateDoc(docRef(...currentTalentPath, id), { shotIds: arrayRemove(shotId) }).catch(
          () => {}
        )
      )
    );
    // Location
    const prevL = before.locationId || null;
    const nextL = after.locationId || null;
    if (prevL && prevL !== nextL) {
      await updateDoc(docRef(...currentLocationsPath, prevL), {
        shotIds: arrayRemove(shotId),
      }).catch(() => {});
    }
    if (nextL && prevL !== nextL) {
      await updateDoc(docRef(...currentLocationsPath, nextL), {
        shotIds: arrayUnion(shotId),
      }).catch(() => {});
    }
  }

  const generateProductId = () => Math.random().toString(36).slice(2, 10);

  const withDerivedProductFields = useCallback(
    (product) => {
      const family = families.find((entry) => entry.id === product.familyId);
      const fallbackSizes = Array.isArray(family?.sizes) ? family.sizes : [];
      const sizeList = Array.isArray(product.sizeList) ? product.sizeList : fallbackSizes;
      const rawStatus = product.status;
      const rawScope = product.sizeScope;
      const hasExplicitSize = product.size != null && product.size !== "";
      const derivedStatus =
        rawStatus === "pending-size"
          ? "pending-size"
          : rawStatus === "complete"
          ? "complete"
          : rawScope === "pending"
          ? "pending-size"
          : hasExplicitSize
          ? "complete"
          : "complete";
      const derivedScope =
        derivedStatus === "pending-size"
          ? "pending"
          : rawScope === "all"
          ? "all"
          : hasExplicitSize
          ? "single"
          : rawScope === "single"
          ? "single"
          : "all";
      const effectiveSize = derivedStatus === "pending-size" ? null : product.size || null;
      const colourImage = product.colourImagePath || product.colourThumbnail || null;
      const imageCandidates = Array.isArray(product.images)
        ? product.images
        : colourImage
        ? [colourImage]
        : [];

      return {
        ...product,
        familyId: product.familyId || family?.id || null,
        familyName: product.familyName || family?.styleName || "",
        styleNumber: product.styleNumber || family?.styleNumber || null,
        thumbnailImagePath:
          product.thumbnailImagePath || family?.thumbnailImagePath || family?.headerImagePath || null,
        colourId: product.colourId || product.colourwayId || null,
        colourwayId: product.colourwayId || product.colourId || null,
        colourName: product.colourName || "",
        colourImagePath: colourImage || null,
        images: imageCandidates,
        skuCode: product.skuCode || null,
        skuId: product.skuId || null,
        size: effectiveSize,
        sizeId: product.sizeId || (effectiveSize ? effectiveSize : null),
        sizeScope: derivedScope,
        status: derivedStatus,
        sizeList,
      };
    },
    [families]
  );

  const normaliseShotProducts = useCallback(
    (shot) => {
      if (Array.isArray(shot?.products) && shot.products.length) {
        return shot.products
          .map((product) => {
            if (!product) return null;
            if (product.familyId) {
              return withDerivedProductFields(product);
            }
            const familyId = product.productId || product.productIdRef;
            if (!familyId) return null;
            const family = families.find((entry) => entry.id === familyId);
            if (!family) return null;
            const base = {
              familyId,
              familyName: product.productName || family.styleName || "",
              styleNumber: product.styleNumber ?? family.styleNumber ?? null,
              thumbnailImagePath:
                product.thumbnailImagePath ||
                family.thumbnailImagePath ||
                family.headerImagePath ||
                null,
              colourId: product.colourId ?? null,
              colourwayId: product.colourId ?? null,
              colourName: product.colourName || "",
              colourImagePath: product.colourImagePath ?? null,
              images: Array.isArray(product.images) ? product.images : [],
              size: product.size ?? null,
              sizeScope:
                product.sizeScope ||
                (product.status === "pending-size"
                  ? "pending"
                  : product.size
                  ? "single"
                  : "all"),
              status: product.status === "pending-size" ? "pending-size" : "complete",
            };
            return withDerivedProductFields(base);
          })
          .filter(Boolean);
      }
      if (!Array.isArray(shot?.productIds)) return [];
      return shot.productIds
        .map((familyId) => {
          const family = families.find((entry) => entry.id === familyId);
          if (!family) return null;
          return withDerivedProductFields({
            id: `legacy-${familyId}`,
            familyId,
            familyName: family.styleName,
            styleNumber: family.styleNumber || null,
            thumbnailImagePath: family.thumbnailImagePath || family.headerImagePath || null,
            colourId: null,
            colourName: "Any colour",
            colourImagePath: null,
            skuCode: null,
            size: null,
            sizeList: Array.isArray(family.sizes) ? family.sizes : [],
            status: "complete",
            sizeScope: "all",
          });
        })
        .filter(Boolean);
    },
    [families, withDerivedProductFields]
  );

  const buildShotProduct = useCallback(
    (selection, previous = null) => {
      const { family, colour, size, status: requestedStatus, sizeScope } = selection;
      const baseStatus = requestedStatus === "pending-size" ? "pending-size" : "complete";
      const resolvedScope =
        baseStatus === "pending-size"
          ? "pending"
          : sizeScope === "all"
          ? "all"
          : size
          ? "single"
          : sizeScope === "single"
          ? "single"
          : "all";
      const resolvedSize =
        baseStatus === "pending-size"
          ? null
          : resolvedScope === "all"
          ? null
          : size || null;
      const colourImage = colour.imagePath || colour.thumbnailImagePath || null;
      const colourImages = Array.isArray(colour.images)
        ? colour.images
        : colourImage
        ? [colourImage]
        : [];

      return {
        id: previous?.id || generateProductId(),
        familyId: family.id,
        familyName: family.styleName,
        styleNumber: family.styleNumber || null,
        thumbnailImagePath:
          family.thumbnailImagePath || family.headerImagePath || colourImage || null,
        colourId: colour.id || null,
        colourwayId: colour.id || null,
        colourName: colour.colorName || "",
        colourImagePath: colourImage || null,
        images: colourImages,
        skuCode: colour.skuCode || null,
        skuId: colour.skuId || null,
        size: resolvedSize,
        sizeId: resolvedSize || null,
        sizeScope: resolvedScope,
        status: baseStatus,
        sizeList: Array.isArray(family.sizes) ? family.sizes : [],
      };
    },
    []
  );

  const loadFamilyDetails = useCallback(
    async (familyId) => {
      if (familyDetailCacheRef.current.has(familyId)) {
        return familyDetailCacheRef.current.get(familyId);
      }
      const skusPath = productFamilySkusPathForClient(familyId);
      const snapshot = await getDocs(
        query(collection(db, ...skusPath), orderBy("colorName", "asc"))
      );
      const colours = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      const details = {
        colours,
        sizes: families.find((family) => family.id === familyId)?.sizes || [],
      };
      familyDetailCacheRef.current.set(familyId, details);
      return details;
    },
    [families, productFamilySkusPathForClient]
  );

  // Subscribe to collections.  We listen to the global shots collection but
  // filter on projectId so that switching projects automatically updates
  // the list without reloading.  Products, talent and locations remain
  // unfiltered because they are global resources.
  useEffect(() => {
    const shotsQuery = query(
      collRef(...currentShotsPath),
      where("projectId", "==", projectId),
      orderBy("date", "asc")
    );
    const unsubShots = onSnapshot(shotsQuery, (snapshot) => {
      setShots(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubFamilies = onSnapshot(
      query(collRef(...currentProductFamiliesPath), orderBy("styleName", "asc")),
      (snapshot) => {
        setFamilies(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    );
    const unsubTalent = onSnapshot(
      query(collRef(...currentTalentPath), orderBy("name", "asc")),
      (snapshot) => {
        setTalent(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setTalentLoadError(null);
      },
      (error) => {
        const { code, message } = describeFirebaseError(error, "Unable to load talent.");
        setTalent([]);
        setTalentLoadError(
          code === "permission-denied"
            ? "You don't have permission to load talent."
            : message
        );
        toast.error({ title: "Failed to load talent", description: `${code}: ${message}` });
      }
    );
    const unsubLocations = onSnapshot(
      query(collRef(...currentLocationsPath), orderBy("name", "asc")),
      (snapshot) => {
        setLocations(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    );
    return () => {
      unsubShots();
      unsubFamilies();
      unsubTalent();
      unsubLocations();
    };
  }, [projectId, currentShotsPath, currentProductFamiliesPath, currentTalentPath, currentLocationsPath]);

  // Create a new shot with validation and error handling.
  const handleCreateShot = async (event) => {
    event.preventDefault();
    const shotPathSegments = currentShotsPath;
    const targetPath = `/${shotPathSegments.join("/")}`;
    const authInfo = buildAuthDebugInfo();

    if (!user) {
      console.warn("[Shots] Create blocked: no authenticated user", {
        path: targetPath,
        projectId,
        ...authInfo,
      });
      toast.error("You must be signed in to create shots.");
      return;
    }

    if (!canEditShots) {
      console.warn("[Shots] Create blocked: insufficient role", {
        path: targetPath,
        projectId,
        ...authInfo,
      });
      toast.error("You do not have permission to create shots.");
      return;
    }

    if (isCreatingShot) return;

    const validation = shotDraftSchema.safeParse(draft);
    if (!validation.success) {
      const message = validation.error.issues.map((issue) => issue.message).join("; ");
      toast.error({ title: "Check shot details", description: message });
      return;
    }

    setIsCreatingShot(true);
    console.info("[Shots] Attempting to create shot", {
      path: targetPath,
      projectId,
      ...authInfo,
    });
    try {
      const productsForWrite = validation.data.products.map((product) => mapProductForWrite(product));
      const talentForWrite = mapTalentForWrite(validation.data.talent);
      const locationId = validation.data.locationId || null;
      const locationName = locationId
        ? locations.find((location) => location.id === locationId)?.name || null
        : null;

      const notesHtml = sanitizeNotesHtml(validation.data.description || "");

      const payload = {
        name: validation.data.name,
        description: notesHtml,
        type: validation.data.type || "",
        date: parseDateToTimestamp(validation.data.date) || null,
        locationId,
        locationName,
        products: productsForWrite,
        productIds: extractProductIds(productsForWrite),
        talent: talentForWrite,
        talentIds: talentForWrite.map((entry) => entry.talentId),
        projectId,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
      };

      const docRefSnap = await writeDoc("create shot", () => addDoc(collRef(...shotPathSegments), payload));
      console.info("[Shots] Shot created", {
        path: targetPath,
        projectId,
        docId: docRefSnap.id,
        ...authInfo,
      });
      await updateReverseIndexes({
        shotId: docRefSnap.id,
        before: { productIds: [], products: [], talentIds: [], locationId: null },
        after: {
          productIds: payload.productIds,
          products: productsForWrite,
          talentIds: payload.talentIds,
          locationId: payload.locationId,
        },
      });

      setDraft({ ...initialShotDraft });
      toast.success(`Shot "${payload.name}" created.`);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.map((issue) => issue.message).join("; ");
        toast.error({ title: "Invalid product selection", description: message });
      } else {
        const { code, message } = describeFirebaseError(error, "Unable to create shot.");
        console.error("[Shots] Failed to create shot", {
          path: targetPath,
          projectId,
          ...authInfo,
          code,
          message,
          error,
        });
        toast.error({
          title: "Failed to create shot",
          description: `${code}: ${message} (${targetPath})`,
        });
      }
    } finally {
      setIsCreatingShot(false);
    }
  };

  // Update an existing shot.  We compute before/after arrays for reverse
  // indexing and only update fields that have changed.  Note: If you allow
  // editing the project assignment in the future, updating the `projectId`
  // here will effectively reassign the shot.
  const updateShot = async (shot, patch) => {
    if (!canEditShots) return;
    const before = {
      productIds: shot.productIds || extractProductIds(shot.products),
      products: shot.products || [],
      talentIds: shot.talentIds || [],
      locationId: shot.locationId || null,
    };

    const docPatch = { ...patch };

    if (Object.prototype.hasOwnProperty.call(patch, "description")) {
      docPatch.description = sanitizeNotesHtml(patch.description || "");
    }

    if (Object.prototype.hasOwnProperty.call(patch, "products") && patch.products != null) {
      const productsForWrite = patch.products.map((product) => mapProductForWrite(product));
      docPatch.products = productsForWrite;
      docPatch.productIds = extractProductIds(productsForWrite);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "date")) {
      docPatch.date = patch.date ? parseDateToTimestamp(patch.date) : null;
    }

    if (Object.prototype.hasOwnProperty.call(patch, "talent") && patch.talent != null) {
      const talentForWrite = mapTalentForWrite(patch.talent);
      docPatch.talent = talentForWrite;
      docPatch.talentIds = talentForWrite.map((entry) => entry.talentId);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "locationId")) {
      const locationId = patch.locationId || null;
      docPatch.locationId = locationId;
      docPatch.locationName = locationId
        ? locations.find((location) => location.id === locationId)?.name || null
        : null;
    }

    const after = {
      productIds: docPatch.productIds ?? before.productIds,
      products: docPatch.products ?? before.products,
      talentIds: docPatch.talentIds ?? before.talentIds,
      locationId: docPatch.locationId ?? before.locationId,
    };

    try {
      await writeDoc("update shot", () => updateDoc(docRef(...currentShotsPath, shot.id), docPatch));
      await updateReverseIndexes({ shotId: shot.id, before, after });
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to update shot.");
      toast.error({ title: "Failed to update shot", description: `${code}: ${message}` });
      throw error;
    }
  };

  // Delete a shot.  We remove it from all reverse indexes before deleting
  // the document itself.
  const removeShot = async (shot) => {
    if (!canEditShots) return;
    await updateReverseIndexes({
      shotId: shot.id,
      before: {
        productIds: shot.productIds || extractProductIds(shot.products),
        products: shot.products || [],
        talentIds: shot.talentIds || [],
        locationId: shot.locationId || null,
      },
      after: { productIds: [], products: [], talentIds: [], locationId: null },
    });
    await writeDoc("delete shot", () => deleteDoc(docRef(...currentShotsPath, shot.id)));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Shots</h1>
        <p className="text-sm text-slate-600">
          Build and manage the shot list for the active project. Set the active project from the Dashboard.
        </p>
      </div>
      {/* Form to create a new shot */}
      {canEditShots ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Create New Shot</h2>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateShot}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  placeholder="Name"
                  value={draft.name}
                  disabled={isCreatingShot}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                />
                <Input
                  placeholder="Type"
                  value={draft.type}
                  disabled={isCreatingShot}
                  onChange={(event) => setDraft({ ...draft, type: event.target.value })}
                />
                <Input
                  placeholder="Date (YYYY-MM-DD)"
                  value={draft.date}
                  type="date"
                  disabled={isCreatingShot}
                  onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Notes</label>
                <NotesEditor
                  value={draft.description}
                  onChange={(next) => setDraft((prev) => ({ ...prev, description: next }))}
                  disabled={isCreatingShot}
                />
                <p className="text-xs text-slate-500">Use bold, italics, or colour highlights to capture key reminders.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Location</label>
                <select
                  className="w-full rounded border border-slate-200 p-2"
                  value={draft.locationId}
                  disabled={isCreatingShot}
                  onChange={(event) => setDraft({ ...draft, locationId: event.target.value || "" })}
                >
                  <option value="">(none)</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Products</label>
                <ShotProductsEditor
                  value={draft.products}
                  onChange={(next) => setDraft((prev) => ({ ...prev, products: next }))}
                  families={families}
                  loadFamilyDetails={loadFamilyDetails}
                  createProduct={buildShotProduct}
                  emptyHint="No products selected"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Talent</label>
                <TalentMultiSelect
                  options={talentOptions}
                  value={draft.talent}
                  onChange={(next) => setDraft((prev) => ({ ...prev, talent: next }))}
                  isDisabled={isCreatingShot}
                  placeholder={talentLoadError ? "Talent unavailable" : "Select talent"}
                  noOptionsMessage={
                    talentLoadError || (talentOptions.length ? "No matching talent" : "No talent available")
                  }
                />
                {talentLoadError && (
                  <p className="text-xs text-red-600">{talentLoadError}</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isCreatingShot}>
                  {isCreatingShot ? "Saving…" : "Add Shot"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          You can browse shots but need producer or crew access to create or edit them.
        </div>
      )}
      {/* List of existing shots */}
      <div className="space-y-4">
        {shots.map((s) => {
          const shotProducts = normaliseShotProducts(s);
          const shotTalentSelection = Array.isArray(s.talent)
            ? s.talent.map((entry) => {
                const fallback = talentOptions.find((opt) => opt.talentId === entry.talentId);
                return {
                  talentId: entry.talentId,
                  name: entry.name || fallback?.name || "Unnamed talent",
                };
              })
            : Array.isArray(s.talentIds)
            ? s.talentIds.map((id) => {
                const fallback = talentOptions.find((opt) => opt.talentId === id);
                return { talentId: id, name: fallback?.name || "Unnamed talent" };
              })
            : [];
          const talentNoOptionsMessage =
            talentLoadError || (talentOptions.length ? "No matching talent" : "No talent available");
          const notesHtml = formatNotesForDisplay(s.description);
          return (
            <Card key={s.id} className="border p-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold">{s.name}</h3>
                <div className="space-x-2">
                  {canEditShots && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const newName = prompt("New name", s.name) || s.name;
                        if (newName !== s.name) updateShot(s, { name: newName });
                      }}
                    >
                      Rename
                    </Button>
                  )}
                  {canEditShots && (
                    <Button type="button" size="sm" variant="destructive" onClick={() => removeShot(s)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {notesHtml ? (
                <div
                  className="rounded-md bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700"
                  dangerouslySetInnerHTML={{ __html: notesHtml }}
                />
              ) : (
                <p className="text-sm text-slate-400">No notes added yet.</p>
              )}
              {/* Inline editors for type and date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="text-sm font-medium mb-1">Type</label>
                  <input
                    className="w-full border rounded p-2"
                    type="text"
                    value={s.type || ""}
                    disabled={!canEditShots}
                    onChange={(e) => updateShot(s, { type: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1">Date</label>
                  <input
                    className="w-full border rounded p-2"
                    type="date"
                    value={toDateInputValue(s.date)}
                    disabled={!canEditShots}
                    onChange={(e) => updateShot(s, { date: e.target.value })}
                  />
                </div>
              </div>
              {/* Quick editors for location, products, talent */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                <div>
                  <label className="text-sm font-medium mb-1">Location</label>
                  <select
                    className="w-full border rounded p-2"
                    value={s.locationId || ""}
                    disabled={!canEditShots}
                    onChange={(e) => updateShot(s, { locationId: e.target.value || null })}
                  >
                    <option value="">(none)</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1">Products</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {shotProducts.map((product) => {
                      const sizeDescriptor =
                        product.status === "pending-size"
                          ? "size pending"
                          : product.sizeScope === "all"
                          ? "all sizes"
                          : product.size
                          ? product.size
                          : "";
                      const chipClass =
                        product.status === "pending-size"
                          ? "rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800"
                          : "rounded-full bg-slate-100 px-3 py-1 text-xs";
                      return (
                        <span key={product.id} className={chipClass}>
                          {product.familyName}
                          {product.colourName ? ` – ${product.colourName}` : ""}
                          {sizeDescriptor ? ` (${sizeDescriptor})` : ""}
                        </span>
                      );
                    })}
                  {!shotProducts.length && (
                    <span className="text-xs text-slate-500">No products linked</span>
                  )}
                  </div>
                  {canEditShots && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setEditingShotProducts({
                          shot: s,
                          products: shotProducts,
                        })
                      }
                    >
                      Manage products
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium mb-1">Talent</label>
                  <TalentMultiSelect
                    options={talentOptions}
                    value={shotTalentSelection}
                    isDisabled={!canEditShots}
                    onChange={(next) => updateShot(s, { talent: next })}
                    placeholder={talentLoadError ? "Talent unavailable" : "Select talent"}
                    noOptionsMessage={talentNoOptionsMessage}
                  />
                  {talentLoadError && (
                    <p className="text-xs text-red-600">{talentLoadError}</p>
                  )}
                </div>
              </div>
            </CardContent>
            </Card>
          );
        })}
      </div>
      {canEditShots && editingShotProducts && (
        <Modal
          open
          onClose={() => setEditingShotProducts(null)}
          labelledBy="manage-shot-products-title"
          contentClassName="p-0 max-h-[90vh] overflow-hidden"
        >
          <Card className="border-0 shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="manage-shot-products-title" className="text-lg font-semibold">
                    Products for {editingShotProducts.shot.name}
                  </h2>
                  <p className="text-sm text-slate-500">Update colourways and sizes, then save to refresh the shot.</p>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  className="text-xl text-slate-400 hover:text-slate-600"
                  onClick={() => setEditingShotProducts(null)}
                >
                  ×
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ShotProductsEditor
                value={editingShotProducts.products}
                onChange={(next) =>
                  setEditingShotProducts((prev) => ({ ...prev, products: next }))
                }
                families={families}
                loadFamilyDetails={loadFamilyDetails}
                createProduct={buildShotProduct}
                emptyHint="No products linked"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditingShotProducts(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    await updateShot(editingShotProducts.shot, {
                      products: editingShotProducts.products,
                    });
                    setEditingShotProducts(null);
                  }}
                >
                  Save products
                </Button>
              </div>
            </CardContent>
          </Card>
        </Modal>
      )}
    </div>
  );
}
