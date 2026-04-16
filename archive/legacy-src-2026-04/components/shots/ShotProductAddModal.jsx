import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { Modal } from "../ui/modal";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { LoadingOverlay, LoadingSpinner } from "../ui/LoadingSpinner";
import AppImage from "../common/AppImage";
import NewProductModal from "../products/NewProductModal";
import NewColourwayModal from "../products/NewColourwayModal";
import { genderLabel } from "../../lib/productMutations";

const ALL_SIZES_VALUE = "__ALL_SIZES__";

const deriveInitialSizeValue = (product) => {
  if (!product) return "";
  if (product.sizeScope === "all") return ALL_SIZES_VALUE;
  return product.size || "";
};

function ColourOption({ colour, selected, onSelect }) {
  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (typeof onSelect === "function") {
      onSelect();
    } else {
      console.error("onSelect is not a function:", onSelect);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex flex-col gap-2 rounded-card border ${
        selected ? "border-primary ring-2 ring-primary/40" : "border-slate-200 dark:border-slate-700"
      } bg-white dark:bg-slate-800 p-3 text-left transition hover:border-primary`}
    >
      <div className="aspect-square w-full overflow-hidden rounded bg-slate-100 dark:bg-slate-700">
        <AppImage
          src={colour.imagePath}
          alt={`${colour.colorName} swatch`}
          preferredSize={320}
          className="h-full w-full"
          imageClassName="h-full w-full object-cover"
          fallback={
            <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">No image</div>
          }
          placeholder={
            <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              Loading…
            </div>
          }
        />
      </div>
      <div className="space-y-1">
        <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-200" title={colour.colorName}>
          {colour.colorName}
        </div>
        {colour.skuCode && (
          <div className="truncate text-xs text-slate-500 dark:text-slate-400" title={colour.skuCode}>
            {colour.skuCode}
          </div>
        )}
        {colour.status !== "active" && (
          <div className="text-xs text-amber-600 dark:text-amber-400">{colour.status}</div>
        )}
      </div>
    </button>
  );
}

export default function ShotProductAddModal({
  open,
  families,
  loadFamilyDetails,
  onSubmit,
  onClose,
  initialProduct = null,
  canCreateProduct = false,
  onCreateProduct,
  onCreateColourway,
}) {
  const [createdFamilies, setCreatedFamilies] = useState([]);

  const availableFamilies = useMemo(() => {
    const base = families.filter((family) => !family.archived);
    if (!createdFamilies.length) return base;
    const existingIds = new Set(base.map((family) => family.id));
    const extras = createdFamilies.filter((family) => !existingIds.has(family.id));
    return [...extras, ...base];
  }, [families, createdFamilies]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState(initialProduct ? "details" : "list");
  const [selectedFamilyId, setSelectedFamilyId] = useState(initialProduct?.familyId || null);
  const [familyDetails, setFamilyDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedColourId, setSelectedColourId] = useState(initialProduct?.colourId || null);
  const [selectedSize, setSelectedSize] = useState(deriveInitialSizeValue(initialProduct));
  const [genderFilter, setGenderFilter] = useState("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createColourwayOpen, setCreateColourwayOpen] = useState(false);

  const scrollRegionRef = useRef(null);

  useEffect(() => {
    if (!createdFamilies.length) return;
    setCreatedFamilies((prev) => {
      const filtered = prev.filter((family) => !families.some((entry) => entry.id === family.id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [families, createdFamilies.length]);

  useEffect(() => {
    if (!selectedFamilyId) {
      setFamilyDetails(null);
      setSelectedColourId(null);
      return;
    }
    let cancelled = false;
    setLoadingDetails(true);
    loadFamilyDetails(selectedFamilyId)
      .then((details) => {
        if (cancelled) return;
        setFamilyDetails(details);
        setLoadingDetails(false);
        if (initialProduct && initialProduct.familyId === selectedFamilyId) {
          setSelectedColourId(initialProduct.colourId || null);
          setSelectedSize(deriveInitialSizeValue(initialProduct));
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFamilyId, loadFamilyDetails, initialProduct]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setView(initialProduct ? "details" : "list");
      setSelectedFamilyId(initialProduct?.familyId || null);
      setFamilyDetails(null);
      setSelectedColourId(initialProduct?.colourId || null);
      setSelectedSize(deriveInitialSizeValue(initialProduct));
      setGenderFilter("all");
      setCreateModalOpen(false);
      setCreateColourwayOpen(false);
    }
  }, [open, initialProduct]);

  const fuse = useMemo(
    () =>
      new Fuse(availableFamilies, {
        keys: [
          { name: "styleName", weight: 0.6 },
          { name: "styleNumber", weight: 0.4 },
          { name: "colorNames", weight: 0.2 },
          { name: "gender", weight: 0.1 },
        ],
        threshold: 0.32,
        ignoreLocation: true,
      }),
    [availableFamilies]
  );

  const genders = useMemo(() => {
    const map = new Map();
    availableFamilies.forEach((family) => {
      const raw = family.gender;
      if (!raw) return;
      const value = raw.toLowerCase();
      if (!map.has(value)) {
        map.set(value, genderLabel(raw));
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [availableFamilies]);

  const filteredFamilies = useMemo(() => {
    const normalisedGender = genderFilter.toLowerCase();
    const base =
      normalisedGender === "all"
        ? availableFamilies
        : availableFamilies.filter(
            (family) => (family.gender || "").toLowerCase() === normalisedGender
          );
    if (!query.trim()) return base;
    const matches = fuse.search(query.trim()).map((result) => result.item);
    return matches.filter((item) => base.includes(item));
  }, [availableFamilies, fuse, query, genderFilter]);

  const activeFamily = useMemo(
    () => availableFamilies.find((entry) => entry.id === selectedFamilyId) || null,
    [availableFamilies, selectedFamilyId]
  );
  const sizes = familyDetails?.sizes || activeFamily?.sizes || [];
  const colours = useMemo(() => {
    if (!familyDetails?.colours) return [];
    return familyDetails.colours.filter((colour) => colour.status !== "archived");
  }, [familyDetails]);

  // Debug colours array updates

  useEffect(() => {
    if (!initialProduct && !selectedColourId && colours.length) {
      setSelectedColourId(colours[0].id);
    }
  }, [colours, initialProduct, selectedColourId]);
  const selectedColour = useMemo(() => {
    const found = colours.find((colour) => colour.id === selectedColourId) || null;
    return found;
  }, [selectedColourId, colours]);

  // Enhanced button state logic for improved workflow
  const hasValidSelection = selectedFamilyId && selectedColour;
  const canAddColourway = hasValidSelection && !loadingDetails;
  const canAddProduct = hasValidSelection && !loadingDetails; // Allow adding even without size
  const hasSize = selectedSize && selectedSize !== "";

  // Debug button state logic

  const handleFamilySelect = (family) => {
    setSelectedFamilyId(family.id);
    setView("details");
    setSelectedSize(deriveInitialSizeValue(null));
  };

  const handleBack = () => {
    setView("list");
    setSelectedFamilyId(null);
    setFamilyDetails(null);
    setSelectedColourId(null);
  };

  const handleOpenCreateModal = () => {
    if (!canCreateProduct || typeof onCreateProduct !== "function") return;
    setCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setCreateModalOpen(false);
  };

  const handleProductCreated = useCallback(async (payload) => {
    if (!canCreateProduct || typeof onCreateProduct !== "function") return;
    try {
      const familyId = await onCreateProduct(payload);
      if (!familyId) return;
      const stubFamily = {
        id: familyId,
        styleName: payload.family?.styleName || "New product",
        styleNumber: payload.family?.styleNumber || "",
        gender: payload.family?.gender || "",
        archived: false,
        sizes: Array.isArray(payload.family?.sizes) ? payload.family.sizes : [],
        colorNames: Array.isArray(payload.colorways)
          ? payload.colorways.map((entry) => entry.name).filter(Boolean)
          : [],
      };
      setCreatedFamilies((prev) => {
        const next = prev.filter((family) => family.id !== familyId);
        next.push(stubFamily);
        return next;
      });
      setSelectedFamilyId(familyId);
      setSelectedColourId(null);
      setSelectedSize(ALL_SIZES_VALUE);
      setView("details");
      setQuery("");
      setGenderFilter("all");
      const optimisticColours = Array.isArray(payload.colorways)
        ? payload.colorways.map((entry) => ({
            id: entry.id || entry.name || Math.random().toString(36).slice(2),
            colorName: entry.name || "New colourway",
            skuCode: entry.sizes?.[0]?.sku || "",
            status: "active",
            imagePath: null,
          }))
        : [];
      if (optimisticColours.length) {
        setFamilyDetails({
          colours: optimisticColours,
          sizes: stubFamily.sizes,
        });
        setSelectedColourId(optimisticColours[0].id || null);
      }
      setLoadingDetails(true);
      try {
        const details = await loadFamilyDetails(familyId);
        setFamilyDetails(details);
        if (details?.colours?.length) {
          setSelectedColourId(details.colours[0].id);
        }
      } catch (error) {
        console.error("[ShotProductAddModal] Failed to load new family", error);
      } finally {
        setLoadingDetails(false);
      }
    } catch (error) {
      throw error;
    }
  }, [canCreateProduct, loadFamilyDetails, onCreateProduct]);

  const handleOpenCreateColourway = () => {
    if (
      !canCreateProduct ||
      typeof onCreateColourway !== "function" ||
      !selectedFamilyId
    )
      return;
    setCreateColourwayOpen(true);
  };

  const handleCloseCreateColourway = () => {
    setCreateColourwayOpen(false);
  };

  const handleColourwaySubmit = async (payload) => {
    if (!selectedFamilyId || typeof onCreateColourway !== "function") {
      throw new Error("Select a product family before creating a colourway.");
    }
    const newColour = await onCreateColourway(selectedFamilyId, payload);
    if (newColour) {
      const fallbackSizes = familyDetails?.sizes || activeFamily?.sizes || [];
      setFamilyDetails((prev) => {
        const existingColours = prev?.colours || [];
        const nextColours = existingColours.filter((colour) => colour.id !== newColour.id);
        nextColours.push(newColour);
        return {
          sizes: prev?.sizes || fallbackSizes,
          colours: nextColours,
        };
      });
      setSelectedColourId(newColour.id || null);
    }
    setCreateColourwayOpen(false);
    return newColour;
  };

  const submitSelection = ({ status }) => {
    if (!hasValidSelection) return;
    const family = families.find((entry) => entry.id === selectedFamilyId);
    if (!family || !selectedColour) return;
    const sizeValue =
      status === "pending-size"
        ? null
        : selectedSize === ALL_SIZES_VALUE
        ? null
        : selectedSize
        ? selectedSize
        : null;
    const sizeScope =
      status === "pending-size"
        ? "pending"
        : selectedSize === ALL_SIZES_VALUE
        ? "all"
        : selectedSize
        ? "single"
        : "pending";
    onSubmit?.({
      family,
      colour: selectedColour,
      size: sizeValue,
      status,
      sizeScope,
    });
    onClose?.();
  };

  useEffect(() => {
    if (!open) return;
    const node = scrollRegionRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      node?.focus?.({ preventScroll: true });
    });
  }, [open, view]);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        labelledBy="shot-product-picker-title"
        contentClassName="p-0"
        initialFocusRef={scrollRegionRef}
      >
      <Card className="flex h-full flex-col border-0 shadow-none">
        <CardHeader className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 id="shot-product-picker-title" className="text-lg font-semibold">
              {view === "list" ? "Select product family" : "Choose colour & size"}
            </h2>
            {view === "details" && activeFamily && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{activeFamily.styleName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {view === "details" && (
              <Button type="button" variant="secondary" size="sm" onClick={handleBack}>
                Back
              </Button>
            )}
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="text-xl text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              ×
            </button>
          </div>
        </CardHeader>
        <div className="flex flex-1 flex-col">
          <div
            ref={scrollRegionRef}
            tabIndex={0}
            data-testid="shot-product-scroll-region"
            className="flex-1 overflow-y-auto overscroll-contain focus-visible:outline-none"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <CardContent data-testid="shot-product-card-content" className="space-y-4 pb-6">
              {view === "list" ? (
                <div className="space-y-4">
                  <Input
                    placeholder="Search products by name or number…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="shot-product-gender-filter"
                        className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
                      >
                        Gender
                      </label>
                      <select
                        id="shot-product-gender-filter"
                        className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:focus:ring-indigo-500"
                        value={genderFilter}
                        onChange={(event) => setGenderFilter(event.target.value)}
                      >
                        <option value="all">All genders</option>
                        {genders.map((genderOption) => (
                          <option key={genderOption.value} value={genderOption.value}>
                            {genderOption.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {canCreateProduct && typeof onCreateProduct === "function" && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleOpenCreateModal}
                        className="self-start sm:self-auto"
                      >
                        Create new product
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {filteredFamilies.map((family) => (
                      <button
                        key={family.id}
                        type="button"
                        className="w-full rounded-card border border-slate-200 dark:border-slate-700 p-3 text-left transition hover:border-primary"
                        onClick={() => handleFamilySelect(family)}
                      >
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{family.styleName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Style #{family.styleNumber}</div>
                        {family.gender && (
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Gender: {genderLabel(family.gender)}
                          </div>
                        )}
                        {family.colorNames?.length ? (
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Colours: {family.colorNames.slice(0, 3).join(", ")}
                            {family.colorNames.length > 3 && "…"}
                          </div>
                        ) : null}
                      </button>
                    ))}
                    {!filteredFamilies.length && (
                      <div className="rounded border border-slate-200 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        No matching product families.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {loadingDetails ? (
                    <LoadingOverlay message="Loading colourways..." />
                  ) : (
                    <>
                      <div className="space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Colourway
                            {!selectedColour && colours.length > 0 && (
                              <span className="ml-1 text-red-500 dark:text-red-400">*</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {selectedColour && (
                              <div className="text-xs font-medium text-green-600 dark:text-green-400">
                                ✓ {selectedColour.colorName} selected
                              </div>
                            )}
                            {selectedFamilyId &&
                              canCreateProduct &&
                              typeof onCreateColourway === "function" && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={handleOpenCreateColourway}
                                >
                                  Add new colourway
                                </Button>
                              )}
                          </div>
                        </div>
                        <div
                          className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
                            !selectedColour && colours.length > 0 ? "rounded-card p-2 ring-1 ring-red-200" : ""
                          }`}
                        >
                          {colours.map((colour) => (
                            <ColourOption
                              key={colour.id}
                              colour={colour}
                              selected={colour.id === selectedColourId}
                              onSelect={() => {
                                setSelectedColourId(colour.id);
                              }}
                            />
                          ))}
                        </div>
                        {!colours.length && (
                          <div className="rounded border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-500 dark:text-slate-400">
                            No colourways available for this family.
                          </div>
                        )}
                        {!selectedColour && colours.length > 0 && (
                          <p className="text-xs text-red-600 dark:text-red-400">Please select a colourway to continue</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Size selection</label>
                          {selectedSize && selectedSize !== "" && (
                            <div className="text-xs font-medium text-green-600 dark:text-green-400">
                              ✓ {selectedSize === ALL_SIZES_VALUE ? "All sizes" : selectedSize} selected
                            </div>
                          )}
                        </div>
                        <select
                          className={`w-full rounded border px-3 py-2 text-sm transition-colors ${
                            selectedSize === ""
                              ? "border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20"
                              : "border-slate-300 dark:border-slate-600"
                          } bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100`}
                          value={selectedSize}
                          onChange={(event) => setSelectedSize(event.target.value)}
                        >
                          <option value="">Decide later</option>
                          <option value={ALL_SIZES_VALUE}>All sizes</option>
                          {sizes.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                        <div className="space-y-1">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Add the colourway now or pick a specific size to lock it in.
                          </p>
                          {selectedSize === "" && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              Size will be marked as "pending" - you can specify it later
                            </p>
                          )}
                          {selectedSize && selectedSize !== "" && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                              {selectedSize === ALL_SIZES_VALUE
                                ? "All available sizes will be added to the shot"
                                : `Only size ${selectedSize} will be added to the shot`}
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </div>
          <footer
            data-testid="shot-product-modal-footer"
            className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-4px_12px_rgba(15,23,42,0.08)] sm:px-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:justify-end sm:gap-4">
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canAddColourway}
                    onClick={() => submitSelection({ status: "pending-size" })}
                    className={!canAddColourway ? "opacity-40" : ""}
                  >
                    {initialProduct ? "Save without size" : "Add colourway"}
                  </Button>
                  {!canAddColourway && !loadingDetails && (
                    <p className="text-center text-xs text-slate-500 dark:text-slate-400">Select a colourway to enable</p>
                  )}
                  {loadingDetails && (
                    <div className="flex justify-center">
                      <LoadingSpinner size="sm" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    disabled={!canAddProduct}
                    onClick={() => submitSelection({ status: "complete" })}
                    className={!canAddProduct ? "opacity-40" : ""}
                  >
                    {initialProduct
                      ? hasSize ? "Save with size" : "Save (size pending)"
                      : selectedSize === ALL_SIZES_VALUE
                      ? "Add all sizes"
                      : hasSize
                      ? `Add with ${selectedSize}`
                      : "Add (size pending)"}
                  </Button>
                  {!canAddProduct && !loadingDetails && (
                    <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                      Select a colourway to continue
                    </p>
                  )}
                  {loadingDetails && (
                    <div className="flex justify-center">
                      <LoadingSpinner size="sm" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </footer>
        </div>
      </Card>
      </Modal>
      {createModalOpen && canCreateProduct && typeof onCreateProduct === "function" && (
        <NewProductModal
          open={createModalOpen}
          onClose={handleCloseCreateModal}
          onSubmit={handleProductCreated}
        />
      )}
      {createColourwayOpen &&
        canCreateProduct &&
        typeof onCreateColourway === "function" && (
          <NewColourwayModal
            open={createColourwayOpen}
            onClose={handleCloseCreateColourway}
            onSubmit={handleColourwaySubmit}
            family={activeFamily || families.find((entry) => entry.id === selectedFamilyId) || null}
          />
        )}
    </>
  );
}
