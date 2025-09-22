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
import { LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import Select from "react-select";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import ShotProductsEditor from "../components/shots/ShotProductsEditor";
import TalentMultiSelect from "../components/shots/TalentMultiSelect";
import NotesEditor from "../components/shots/NotesEditor";
import { useAuth } from "../context/AuthContext";
import { canManageShots, resolveEffectiveRole } from "../lib/rbac";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { writeDoc } from "../lib/firestoreWrites";
import { toast } from "../lib/toast";
import { formatNotesForDisplay, sanitizeNotesHtml } from "../lib/sanitize";
import { useStorageImage } from "../hooks/useStorageImage";
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

const SHOTS_VIEW_STORAGE_KEY = "shots:viewMode";
const SHOTS_FILTERS_STORAGE_KEY = "shots:filters";

const defaultShotFilters = {
  locationId: "",
  talentIds: [],
  productFamilyIds: [],
};

const filterSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderRadius: 6,
    borderColor: state.isFocused ? "#2563eb" : "#cbd5f5",
    boxShadow: state.isFocused ? "0 0 0 1px rgba(37, 99, 235, 0.35)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "#2563eb" : "#94a3b8",
    },
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: "#e2e8f0",
    borderRadius: 9999,
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "#0f172a",
    fontWeight: 500,
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: "#475569",
    ":hover": {
      backgroundColor: "#cbd5f5",
      color: "#1d4ed8",
    },
  }),
  menuPortal: (base) => ({ ...base, zIndex: 40 }),
};

const readStoredShotsView = () => {
  if (typeof window === "undefined") return "gallery";
  const stored = window.localStorage.getItem(SHOTS_VIEW_STORAGE_KEY);
  return stored === "list" ? "list" : "gallery";
};

const readStoredShotFilters = () => {
  if (typeof window === "undefined") return { ...defaultShotFilters };
  try {
    const raw = window.localStorage.getItem(SHOTS_FILTERS_STORAGE_KEY);
    if (!raw) return { ...defaultShotFilters };
    const parsed = JSON.parse(raw);
    return {
      locationId: typeof parsed.locationId === "string" ? parsed.locationId : "",
      talentIds: Array.isArray(parsed.talentIds)
        ? parsed.talentIds.filter((value) => typeof value === "string" && value)
        : [],
      productFamilyIds: Array.isArray(parsed.productFamilyIds)
        ? parsed.productFamilyIds.filter((value) => typeof value === "string" && value)
        : [],
    };
  } catch (error) {
    console.warn("[Shots] Failed to parse stored filters", error);
    return { ...defaultShotFilters };
  }
};

export default function ShotsPage() {
  const [shots, setShots] = useState([]);
  const [queryText, setQueryText] = useState("");
  const [draft, setDraft] = useState({ ...initialShotDraft });
  const [families, setFamilies] = useState([]);
  const [talent, setTalent] = useState([]);
  const [locations, setLocations] = useState([]);
  const [talentLoadError, setTalentLoadError] = useState(null);
  const [isCreatingShot, setIsCreatingShot] = useState(false);
  const [viewMode, setViewMode] = useState(() => readStoredShotsView());
  const [filters, setFilters] = useState(() => readStoredShotFilters());
  const [editingShot, setEditingShot] = useState(null);
  const [isSavingShot, setIsSavingShot] = useState(false);
  const projectId = getActiveProjectId();
  const { clientId, role: globalRole, projectRoles = {}, user, claims } = useAuth();
  const userRole = useMemo(
    () => resolveEffectiveRole(globalRole, projectRoles, projectId),
    [globalRole, projectRoles, projectId]
  );
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

  const locationById = useMemo(() => {
    const lookup = new Map();
    locations.forEach((entry) => {
      if (!entry) return;
      lookup.set(entry.id, entry.name || "Unnamed location");
    });
    return lookup;
  }, [locations]);

  const talentFilterOptions = useMemo(
    () => talentOptions.map((entry) => ({ value: entry.talentId, label: entry.name })),
    [talentOptions]
  );
  const productFilterOptions = useMemo(
    () =>
      families.map((family) => ({
        value: family.id,
        label: family.styleName || "Untitled product",
      })),
    [families]
  );

  const talentFilterValue = useMemo(
    () =>
      (filters.talentIds || []).map((id) =>
        talentFilterOptions.find((option) => option.value === id) || {
          value: id,
          label: "Unknown talent",
        }
      ),
    [filters.talentIds, talentFilterOptions]
  );

  const productFilterValue = useMemo(
    () =>
      (filters.productFamilyIds || []).map((id) =>
        productFilterOptions.find((option) => option.value === id) || {
          value: id,
          label: "Unknown product",
        }
      ),
    [filters.productFamilyIds, productFilterOptions]
  );

  const filteredShots = useMemo(() => {
    const term = queryText.trim().toLowerCase();
    const selectedLocation = filters.locationId || "";
    const selectedTalentIds = new Set(filters.talentIds || []);
    const selectedProductIds = new Set(filters.productFamilyIds || []);

    return shots.filter((shot) => {
      if (selectedLocation && (shot.locationId || "") !== selectedLocation) {
        return false;
      }

      if (selectedTalentIds.size) {
        const shotTalentIds = Array.isArray(shot.talent)
          ? shot.talent.map((entry) => entry.talentId).filter(Boolean)
          : Array.isArray(shot.talentIds)
          ? shot.talentIds.filter(Boolean)
          : [];
        const hasTalentMatch = shotTalentIds.some((id) => selectedTalentIds.has(id));
        if (!hasTalentMatch) return false;
      }

      if (selectedProductIds.size) {
        const shotProductIds = extractProductIds(shot.products || [])
          .concat(Array.isArray(shot.productIds) ? shot.productIds : [])
          .filter(Boolean);
        const hasProductMatch = shotProductIds.some((id) => selectedProductIds.has(id));
        if (!hasProductMatch) return false;
      }

      if (!term) return true;

      const talentNames = Array.isArray(shot.talent)
        ? shot.talent.map((entry) => entry.name)
        : Array.isArray(shot.talentIds)
        ? shot.talentIds
            .map((id) => talentOptions.find((option) => option.talentId === id)?.name)
            .filter(Boolean)
        : [];
      const productNames = Array.isArray(shot.products)
        ? shot.products
            .map((product) =>
              [product.productName, product.styleNumber].filter(Boolean).join(" ")
            )
            .filter(Boolean)
        : [];
      const plainNotes = typeof shot.description === "string"
        ? shot.description.replace(/<[^>]+>/g, " ")
        : "";
      const haystack = [
        shot.name,
        shot.type,
        shot.locationName || locationById.get(shot.locationId || ""),
        ...talentNames,
        ...productNames,
        plainNotes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [shots, queryText, filters, talentOptions, locationById]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SHOTS_VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SHOTS_FILTERS_STORAGE_KEY,
      JSON.stringify({
        locationId: filters.locationId || "",
        talentIds: Array.isArray(filters.talentIds) ? filters.talentIds : [],
        productFamilyIds: Array.isArray(filters.productFamilyIds)
          ? filters.productFamilyIds
          : [],
      })
    );
  }, [filters]);

  const familyDetailCacheRef = useRef(new Map());
  const createFormRef = useRef(null);
  const createNameInputRef = useRef(null);

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

  const mapShotTalentToSelection = useCallback(
    (shot) => {
      if (!shot) return [];
      if (Array.isArray(shot.talent) && shot.talent.length) {
        return shot.talent
          .map((entry) => {
            if (!entry || !entry.talentId) return null;
            const fallback = talentOptions.find((opt) => opt.talentId === entry.talentId);
            return {
              talentId: entry.talentId,
              name: entry.name || fallback?.name || "Unnamed talent",
            };
          })
          .filter(Boolean);
      }
      if (Array.isArray(shot.talentIds) && shot.talentIds.length) {
        return shot.talentIds
          .map((id) => {
            if (!id) return null;
            const fallback = talentOptions.find((opt) => opt.talentId === id);
            return { talentId: id, name: fallback?.name || "Unnamed talent" };
          })
          .filter(Boolean);
      }
      return [];
    },
    [talentOptions]
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
    if (!projectId) {
      setShots([]);
      return undefined;
    }

    const handleSubscriptionError = (scope) => (error) => {
      const { code, message } = describeFirebaseError(
        error,
        `Unable to load ${scope}.`
      );
      console.error(`[Shots] Failed to subscribe to ${scope}`, error);
      toast.error({ title: `Failed to load ${scope}`, description: `${code}: ${message}` });
      if (scope === "shots") {
        setShots([]);
      }
    };

    const shotsQuery = query(
      collRef(...currentShotsPath),
      where("projectId", "==", projectId),
      orderBy("date", "asc")
    );
    const unsubShots = onSnapshot(
      shotsQuery,
      (snapshot) => {
        setShots(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      handleSubscriptionError("shots")
    );
    const unsubFamilies = onSnapshot(
      query(collRef(...currentProductFamiliesPath), orderBy("styleName", "asc")),
      (snapshot) => {
        setFamilies(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      handleSubscriptionError("product families")
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
      },
      handleSubscriptionError("locations")
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

  const scrollToCreateShot = () => {
    if (!canEditShots) return;
    if (createFormRef.current) {
      createFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const focusField = () => {
      if (createNameInputRef.current) {
        try {
          createNameInputRef.current.focus({ preventScroll: true });
        } catch {
          createNameInputRef.current.focus();
        }
      }
    };
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(focusField);
    } else {
      focusField();
    }
  };

  const handleLocationFilterChange = useCallback((nextId) => {
    setFilters((previous) => ({
      ...previous,
      locationId: nextId || "",
    }));
  }, []);

  const handleTalentFilterChange = useCallback((selected) => {
    const ids = Array.isArray(selected) ? selected.map((option) => option.value) : [];
    setFilters((previous) => ({
      ...previous,
      talentIds: ids,
    }));
  }, []);

  const handleProductFilterChange = useCallback((selected) => {
    const ids = Array.isArray(selected) ? selected.map((option) => option.value) : [];
    setFilters((previous) => ({
      ...previous,
      productFamilyIds: ids,
    }));
  }, []);

  const clearFilters = useCallback(
    () => setFilters({ ...defaultShotFilters }),
    []
  );

  const updateViewMode = useCallback(
    (nextMode) =>
      setViewMode((previousMode) => (previousMode === nextMode ? previousMode : nextMode)),
    []
  );

  const openShotEditor = useCallback(
    (shot) => {
      if (!shot) return;
      try {
        const products = normaliseShotProducts(shot);
        const talentSelection = mapShotTalentToSelection(shot);
        setEditingShot({
          shot,
          draft: {
            name: shot.name || "",
            description: shot.description || "",
            type: shot.type || "",
            date: toDateInputValue(shot.date),
            locationId: shot.locationId || "",
            talent: talentSelection,
            products,
          },
        });
      } catch (error) {
        console.error("[Shots] Failed to prepare shot for editing", error);
        toast.error("Unable to open shot editor");
      }
    },
    [mapShotTalentToSelection, normaliseShotProducts]
  );

  const handleEditShot = useCallback(
    (shot) => {
      if (!canEditShots) return;
      openShotEditor(shot);
    },
    [canEditShots, openShotEditor]
  );

  const updateEditingDraft = useCallback((patch) => {
    setEditingShot((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        draft: {
          ...previous.draft,
          ...patch,
        },
      };
    });
  }, []);

  const closeShotEditor = useCallback(() => {
    setEditingShot(null);
    setIsSavingShot(false);
  }, []);

  const handleSaveShot = useCallback(async () => {
    if (!editingShot) return;
    if (!canEditShots) {
      toast.error("You do not have permission to edit shots.");
      return;
    }

    setIsSavingShot(true);
    try {
      const parsed = shotDraftSchema.parse({
        ...editingShot.draft,
        locationId: editingShot.draft.locationId || "",
      });
      await updateShot(editingShot.shot, {
        name: parsed.name,
        description: parsed.description || "",
        type: parsed.type || "",
        date: parsed.date || "",
        locationId: parsed.locationId || null,
        talent: parsed.talent,
        products: parsed.products,
      });
      toast.success(`Shot "${parsed.name}" updated.`);
      setEditingShot(null);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.map((issue) => issue.message).join("; ");
        toast.error({ title: "Invalid shot details", description: message });
      } else {
        const { code, message } = describeFirebaseError(error, "Unable to update shot.");
        toast.error({ title: "Failed to update shot", description: `${code}: ${message}` });
      }
      console.error("[Shots] Failed to save shot", error);
    } finally {
      setIsSavingShot(false);
    }
  }, [editingShot, canEditShots, updateShot]);

  const selectPortalTarget =
    typeof window === "undefined" ? undefined : window.document.body;
  const filtersApplied = Boolean(
    (filters.locationId && filters.locationId.length) ||
      (Array.isArray(filters.talentIds) && filters.talentIds.length) ||
      (Array.isArray(filters.productFamilyIds) && filters.productFamilyIds.length)
  );
  const isGalleryView = viewMode === "gallery";
  const isListView = viewMode === "list";
  const talentNoOptionsMessage =
    talentLoadError || (talentOptions.length ? "No matching talent" : "No talent available");

  return (
    <div className="space-y-6">
      <div className="sticky inset-x-0 top-14 z-20 border-b border-slate-200 bg-white/95 py-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="flex-none text-2xl font-semibold text-slate-900">Shots</h1>
            <Input
              placeholder="Search shots by name, talent, product, or location..."
              aria-label="Search shots"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              className="min-w-[200px] flex-1"
            />
            {canEditShots && (
              <Button type="button" onClick={scrollToCreateShot} className="flex-none whitespace-nowrap">
                New shot
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">View</span>
              <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => updateViewMode("gallery")}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm transition ${
                    isGalleryView ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                  aria-pressed={isGalleryView}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  Gallery
                </button>
                <button
                  type="button"
                  onClick={() => updateViewMode("list")}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm transition ${
                    isListView ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                  aria-pressed={isListView}
                >
                  <List className="h-4 w-4" aria-hidden="true" />
                  List
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
            </div>
            <select
              className="h-9 rounded-md border border-slate-200 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
              value={filters.locationId}
              onChange={(event) => handleLocationFilterChange(event.target.value)}
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <div className="min-w-[200px] flex-1 sm:flex-none">
              <Select
                isMulti
                classNamePrefix="filter-select"
                styles={filterSelectStyles}
                options={talentFilterOptions}
                value={talentFilterValue}
                onChange={handleTalentFilterChange}
                placeholder={talentOptions.length ? "Filter talent" : "No talent available"}
                isDisabled={!talentOptions.length}
                noOptionsMessage={() =>
                  talentOptions.length ? "No matching talent" : "No talent available"
                }
                menuPortalTarget={selectPortalTarget}
                closeMenuOnSelect={false}
              />
            </div>
            <div className="min-w-[200px] flex-1 sm:flex-none">
              <Select
                isMulti
                classNamePrefix="filter-select"
                styles={filterSelectStyles}
                options={productFilterOptions}
                value={productFilterValue}
                onChange={handleProductFilterChange}
                placeholder={productFilterOptions.length ? "Filter products" : "No products available"}
                isDisabled={!productFilterOptions.length}
                noOptionsMessage={() =>
                  productFilterOptions.length ? "No matching products" : "No products available"
                }
                menuPortalTarget={selectPortalTarget}
                closeMenuOnSelect={false}
              />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} disabled={!filtersApplied}>
              Clear
            </Button>
          </div>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Build and manage the shot list for the active project. Set the active project from the Dashboard.
      </p>
      {canEditShots ? (
        <div ref={createFormRef}>
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Create New Shot</h2>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateShot}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Name</label>
                    <Input
                      placeholder="Name"
                      value={draft.name}
                      disabled={isCreatingShot}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      ref={createNameInputRef}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Type</label>
                    <Input
                      placeholder="Type"
                      value={draft.type}
                      disabled={isCreatingShot}
                      onChange={(event) => setDraft({ ...draft, type: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Date</label>
                    <Input
                      placeholder="Date"
                      value={draft.date}
                      type="date"
                      disabled={isCreatingShot}
                      onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Notes</label>
                  <NotesEditor
                    value={draft.description}
                    onChange={(next) => setDraft((prev) => ({ ...prev, description: next }))}
                    disabled={isCreatingShot}
                  />
                  <p className="text-xs text-slate-500">
                    Use bold, italics, or colour highlights to capture key reminders.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Location</label>
                  <select
                    className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
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
                    noOptionsMessage={talentNoOptionsMessage}
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
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          You can browse shots but need producer or crew access to create or edit them.
        </div>
      )}
      <div className="space-y-4">
        {filteredShots.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            {shots.length
              ? "No shots match the current search or filters."
              : "No shots have been added yet."}
          </div>
        ) : isGalleryView ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredShots.map((shot) => {
              const shotProducts = normaliseShotProducts(shot);
              const shotTalentSelection = mapShotTalentToSelection(shot);
              const notesHtml = formatNotesForDisplay(shot.description);
              const locationName =
                shot.locationName || locationById.get(shot.locationId || "") || "Unassigned";
              return (
                <ShotGalleryCard
                  key={shot.id}
                  shot={shot}
                  locationName={locationName}
                  products={shotProducts}
                  talent={shotTalentSelection}
                  notesHtml={notesHtml}
                  canEditShots={canEditShots}
                  onEdit={() => handleEditShot(shot)}
                  onDelete={() => removeShot(shot)}
                />
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredShots.map((shot) => {
              const shotProducts = normaliseShotProducts(shot);
              const shotTalentSelection = mapShotTalentToSelection(shot);
              const notesHtml = formatNotesForDisplay(shot.description);
              const locationName =
                shot.locationName || locationById.get(shot.locationId || "") || "Unassigned";
              return (
                <ShotListCard
                  key={shot.id}
                  shot={shot}
                  locationName={locationName}
                  products={shotProducts}
                  talent={shotTalentSelection}
                  notesHtml={notesHtml}
                  canEditShots={canEditShots}
                  onEdit={() => handleEditShot(shot)}
                  onDelete={() => removeShot(shot)}
                />
              );
            })}
          </div>
        )}
      </div>
      {!canEditShots && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Shot actions are read-only for your role.
        </div>
      )}
      {canEditShots && editingShot && (
        <Modal
          open
          onClose={closeShotEditor}
          labelledBy="edit-shot-modal-title"
          contentClassName="p-0 max-h-[90vh] overflow-y-auto"
        >
          <Card className="border-0 shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="edit-shot-modal-title" className="text-lg font-semibold">
                    Edit {editingShot.shot.name}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Update shot details, linked products, and talent assignments.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  className="text-xl text-slate-400 transition hover:text-slate-600"
                  onClick={closeShotEditor}
                >
                  ×
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSaveShot();
                }}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Name</label>
                    <Input
                      value={editingShot.draft.name}
                      onChange={(event) => updateEditingDraft({ name: event.target.value })}
                      required
                      disabled={isSavingShot}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Type</label>
                    <Input
                      value={editingShot.draft.type}
                      onChange={(event) => updateEditingDraft({ type: event.target.value })}
                      disabled={isSavingShot}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Date</label>
                    <Input
                      type="date"
                      value={editingShot.draft.date || ""}
                      onChange={(event) => updateEditingDraft({ date: event.target.value })}
                      disabled={isSavingShot}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Notes</label>
                  <NotesEditor
                    value={editingShot.draft.description}
                    onChange={(next) => updateEditingDraft({ description: next })}
                    disabled={isSavingShot}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Location</label>
                  <select
                    className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
                    value={editingShot.draft.locationId}
                    disabled={isSavingShot}
                    onChange={(event) => updateEditingDraft({ locationId: event.target.value || "" })}
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
                    value={editingShot.draft.products}
                    onChange={(next) => updateEditingDraft({ products: next })}
                    families={families}
                    loadFamilyDetails={loadFamilyDetails}
                    createProduct={buildShotProduct}
                    emptyHint="No products linked"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Talent</label>
                  <TalentMultiSelect
                    options={talentOptions}
                    value={editingShot.draft.talent}
                    onChange={(next) => updateEditingDraft({ talent: next })}
                    isDisabled={isSavingShot}
                    placeholder={talentLoadError ? "Talent unavailable" : "Select talent"}
                    noOptionsMessage={talentNoOptionsMessage}
                  />
                  {talentLoadError && (
                    <p className="text-xs text-red-600">{talentLoadError}</p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={closeShotEditor}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSavingShot}>
                    {isSavingShot ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </Modal>
      )}
    </div>
  );
}


function selectShotImage(products = []) {
  for (const product of products) {
    if (!product) continue;
    if (product.thumbnailImagePath) return product.thumbnailImagePath;
    if (Array.isArray(product.images)) {
      const candidate = product.images.find(Boolean);
      if (candidate) return candidate;
    }
    if (product.colourImagePath) return product.colourImagePath;
  }
  return null;
}

function ShotProductChips({ products }) {
  if (!Array.isArray(products) || products.length === 0) {
    return <p className="mt-1 text-xs text-slate-500">No products linked</p>;
  }
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {products.map((product, index) => {
        if (!product) return null;
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
            : "rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700";
        const key =
          product.id ||
          `${product.familyId || "family"}-${product.colourId || "colour"}-${index}`;
        return (
          <span key={key} className={chipClass}>
            {product.familyName}
            {product.colourName ? ` – ${product.colourName}` : ""}
            {sizeDescriptor ? ` (${sizeDescriptor})` : ""}
          </span>
        );
      })}
    </div>
  );
}

function ShotTalentList({ talent }) {
  if (!Array.isArray(talent) || talent.length === 0) {
    return <p className="mt-1 text-xs text-slate-500">No talent assigned</p>;
  }
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {talent.map((entry) => {
        if (!entry) return null;
        const key = entry.talentId || entry.name;
        return (
          <span key={key} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
            {entry.name}
          </span>
        );
      })}
    </div>
  );
}

function ShotListCard({
  shot,
  locationName,
  products,
  talent,
  notesHtml,
  canEditShots,
  onEdit,
  onDelete,
}) {
  const formattedDate = toDateInputValue(shot.date);
  return (
    <Card className="border">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{shot.name}</h3>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
              {formattedDate && <span>Date: {formattedDate}</span>}
              {shot.type && <span>Type: {shot.type}</span>}
              {locationName && <span>Location: {locationName}</span>}
            </div>
          </div>
          {canEditShots && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
                Edit
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
                Delete
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {notesHtml ? (
          <div
            className="rounded-md bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700"
            dangerouslySetInnerHTML={{ __html: notesHtml }}
          />
        ) : (
          <p className="text-sm text-slate-400">No notes added yet.</p>
        )}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Products
          </span>
          <ShotProductChips products={products} />
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Talent
          </span>
          <ShotTalentList talent={talent} />
        </div>
      </CardContent>
    </Card>
  );
}

function ShotGalleryCard({
  shot,
  locationName,
  products,
  talent,
  notesHtml,
  canEditShots,
  onEdit,
  onDelete,
}) {
  const imagePath = useMemo(() => selectShotImage(products), [products]);
  const imageUrl = useStorageImage(imagePath || null, { preferredSize: 640 });
  const displayImage = imageUrl || imagePath;
  const formattedDate = toDateInputValue(shot.date);
  const plainNotes = notesHtml
    ? notesHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : "";

  return (
    <Card className="overflow-hidden border">
      <div className="relative h-48 bg-slate-100">
        {displayImage ? (
          <img src={displayImage} alt={`${shot.name} preview`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
            No preview available
          </div>
        )}
        {canEditShots && (
          <div className="absolute right-3 top-3 flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
              Edit
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
              Delete
            </Button>
          </div>
        )}
      </div>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">{shot.name}</h3>
          {shot.type && <span className="text-xs uppercase tracking-wide text-primary">{shot.type}</span>}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          {formattedDate && <span>{formattedDate}</span>}
          {locationName && <span>{locationName}</span>}
        </div>
        {plainNotes ? (
          <p className="text-sm text-slate-600">{plainNotes}</p>
        ) : (
          <p className="text-sm text-slate-400">No notes added yet.</p>
        )}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Products
          </span>
          <ShotProductChips products={products} />
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Talent
          </span>
          <ShotTalentList talent={talent} />
        </div>
      </CardContent>
    </Card>
  );
}
