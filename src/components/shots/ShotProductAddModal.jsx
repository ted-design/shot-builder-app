import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Modal } from "../ui/modal";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useStorageImage } from "../../hooks/useStorageImage";

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
  const [selectedSize, setSelectedSize] = useState(initialProduct?.size || "");

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
          setSelectedSize(initialProduct.size || "");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFamilyId, loadFamilyDetails]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setView(initialProduct ? "details" : "list");
      setSelectedFamilyId(initialProduct?.familyId || null);
      setFamilyDetails(null);
      setSelectedColourId(initialProduct?.colourId || null);
      setSelectedSize(initialProduct?.size || "");
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
  };

  const handleBack = () => {
    setView("list");
    setSelectedFamilyId(null);
    setFamilyDetails(null);
    setSelectedColourId(null);
  };

  const handleSubmit = () => {
    if (disableSave) return;
    const family = families.find((entry) => entry.id === selectedFamilyId);
    if (!family || !selectedColour) return;
    onSubmit?.({
      family,
      colour: selectedColour,
      size: selectedSize ? selectedSize : null,
    });
    onClose?.();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="shot-product-picker-title"
      contentClassName="p-0 max-h-[90vh] overflow-hidden"
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex items-center justify-between">
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
        <CardContent className="space-y-4">
          {view === "list" ? (
            <>
              <Input
                placeholder="Search products by name or number…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {filteredFamilies.map((family) => (
                  <button
                    key={family.id}
                    type="button"
                    className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-primary"
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
            </>
          ) : (
            <>
              {loadingDetails ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading colourways…</div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-slate-700">Colourway</div>
                    <div className="grid gap-3 sm:grid-cols-2">
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
                      <option value="">Use all sizes</option>
                      {sizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">
                      Select a specific size to override the family default for this shot.
                    </p>
                  </div>
                </>
              )}
            </>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={disableSave || loadingDetails}>
              {initialProduct ? "Save" : "Add product"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
