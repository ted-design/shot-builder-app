import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { Modal } from "../ui/modal";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useStorageImage } from "../../hooks/useStorageImage";

const ALL_SIZES_VALUE = "__ALL_SIZES__";

const deriveInitialSizeValue = (product) => {
  if (!product) return "";
  if (product.sizeScope === "all") return ALL_SIZES_VALUE;
  return product.size || "";
};

function ColourOption({ colour, selected, onSelect }) {
  const imageUrl = useStorageImage(colour.imagePath);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col gap-2 rounded-lg border ${
        selected ? "border-primary ring-2 ring-primary/40" : "border-slate-200"
      } bg-white p-3 text-left transition hover:border-primary`}
    >
      <div className="aspect-square w-full overflow-hidden rounded bg-slate-100">
        {imageUrl ? (
          <img src={imageUrl} alt={`${colour.colorName} swatch`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">No image</div>
        )}
      </div>
      <div className="space-y-1">
        <div className="truncate text-sm font-medium text-slate-800" title={colour.colorName}>
          {colour.colorName}
        </div>
        {colour.skuCode && (
          <div className="truncate text-xs text-slate-500" title={colour.skuCode}>
            {colour.skuCode}
          </div>
        )}
        {colour.status !== "active" && (
          <div className="text-xs text-amber-600">{colour.status}</div>
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
}) {
  const availableFamilies = useMemo(
    () => families.filter((family) => !family.archived),
    [families]
  );
  const [query, setQuery] = useState("");
  const [view, setView] = useState(initialProduct ? "details" : "list");
  const [selectedFamilyId, setSelectedFamilyId] = useState(initialProduct?.familyId || null);
  const [familyDetails, setFamilyDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedColourId, setSelectedColourId] = useState(initialProduct?.colourId || null);
  const [selectedSize, setSelectedSize] = useState(deriveInitialSizeValue(initialProduct));
  const scrollRegionRef = useRef(null);

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
    }
  }, [open, initialProduct]);

  const fuse = useMemo(
    () =>
      new Fuse(availableFamilies, {
        keys: [
          { name: "styleName", weight: 0.6 },
          { name: "styleNumber", weight: 0.4 },
          { name: "colorNames", weight: 0.2 },
        ],
        threshold: 0.32,
        ignoreLocation: true,
      }),
    [availableFamilies]
  );

  const filteredFamilies = useMemo(() => {
    if (!query.trim()) return availableFamilies;
    return fuse.search(query.trim()).map((result) => result.item);
  }, [availableFamilies, fuse, query]);

  const activeFamily = familyDetails ? families.find((entry) => entry.id === selectedFamilyId) : null;
  const sizes = familyDetails?.sizes || activeFamily?.sizes || [];
  const colours = useMemo(() => {
    if (!familyDetails?.colours) return [];
    return familyDetails.colours.filter((colour) => colour.status !== "archived");
  }, [familyDetails]);

  useEffect(() => {
    if (!initialProduct && !selectedColourId && colours.length) {
      setSelectedColourId(colours[0].id);
    }
  }, [colours, initialProduct, selectedColourId]);
  const selectedColour = colours.find((colour) => colour.id === selectedColourId) || null;

  const disableSave = !selectedFamilyId || !selectedColour;

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

  const submitSelection = ({ status }) => {
    if (disableSave) return;
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
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="shot-product-picker-title"
      contentClassName="flex h-[100vh] max-h-[100vh] flex-col overflow-hidden p-0 sm:h-auto sm:max-h-[85vh]"
      initialFocusRef={scrollRegionRef}
    >
      <Card className="flex h-full flex-col border-0 shadow-none">
        <CardHeader className="flex items-center justify-between border-b border-slate-200">
          <div>
            <h2 id="shot-product-picker-title" className="text-lg font-semibold">
              {view === "list" ? "Select product family" : "Choose colour & size"}
            </h2>
            {view === "details" && activeFamily && (
              <p className="text-sm text-slate-500">{activeFamily.styleName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {view === "details" && (
              <Button variant="secondary" size="sm" onClick={handleBack}>
                Back
              </Button>
            )}
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="text-xl text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          </div>
        </CardHeader>
        <div
          ref={scrollRegionRef}
          tabIndex={0}
          className="flex-1 overflow-y-auto overscroll-contain focus-visible:outline-none"
        >
          <CardContent className="space-y-4 pb-28">
            {view === "list" ? (
              <div className="space-y-4">
                <Input
                  placeholder="Search products by name or number…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <div className="space-y-2">
                  {filteredFamilies.map((family) => (
                    <button
                      key={family.id}
                      type="button"
                      className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-primary"
                      onClick={() => handleFamilySelect(family)}
                    >
                      <div className="text-sm font-medium text-slate-800">{family.styleName}</div>
                      <div className="text-xs text-slate-500">Style #{family.styleNumber}</div>
                      {family.colorNames?.length ? (
                        <div className="mt-1 text-xs text-slate-500">
                          Colours: {family.colorNames.slice(0, 3).join(", ")}
                          {family.colorNames.length > 3 && "…"}
                        </div>
                      ) : null}
                    </button>
                  ))}
                  {!filteredFamilies.length && (
                    <div className="rounded border border-slate-200 p-6 text-center text-sm text-slate-500">
                      No matching product families.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {loadingDetails ? (
                  <div className="py-12 text-center text-sm text-slate-500">Loading colourways…</div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-slate-700">Colourway</div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {colours.map((colour) => (
                          <ColourOption
                            key={colour.id}
                            colour={colour}
                            selected={colour.id === selectedColourId}
                            onSelect={() => setSelectedColourId(colour.id)}
                          />
                        ))}
                      </div>
                      {!colours.length && (
                        <div className="rounded border border-slate-200 p-4 text-sm text-slate-500">
                          No colourways available for this family.
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Size selection</label>
                      <select
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
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
                      <p className="text-xs text-slate-500">
                        Add the colourway now or pick a specific size to lock it in.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
          <div className="sticky bottom-0 flex flex-col gap-2 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={disableSave || loadingDetails}
                onClick={() => submitSelection({ status: "pending-size" })}
              >
                {initialProduct ? "Save without size" : "Add colourway"}
              </Button>
              <Button
                type="button"
                disabled={
                  disableSave ||
                  loadingDetails ||
                  (!selectedSize || selectedSize === "")
                }
                onClick={() => submitSelection({ status: "complete" })}
              >
                {initialProduct ? "Save with size" : "Add & choose size now"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </Modal>
  );
}
