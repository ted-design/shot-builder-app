import React, { useCallback, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useColorSwatches } from "../hooks/useColorSwatches";
import { useProducts } from "../hooks/useFirestoreQuery";
import { productFamiliesPath, productFamilySkusPath } from "../lib/paths";
import { normalizeColorName, upsertColorSwatch, deleteColorSwatch } from "../lib/colorPalette";
import { isValidHexColor } from "../lib/colorExtraction";
import { canEditProducts } from "../lib/rbac";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "../lib/toast";
import AppImage from "../components/common/AppImage";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { PageHeader } from "../components/ui/PageHeader";

const emptyDraft = {
  name: "",
  hexColor: "",
  aliases: "",
  file: null,
  previewUrl: null,
};

const normaliseAliases = (value) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

export default function PalettePage() {
  const { clientId, role } = useAuth();
  const canEdit = canEditProducts(role);
  const { swatches = [], paletteIndex, loading } = useColorSwatches(clientId);
  const { data: families = [] } = useProducts(clientId);

  const [drafts, setDrafts] = useState({});
  const [newDraft, setNewDraft] = useState(emptyDraft);
  const [savingKey, setSavingKey] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");

  const usageCounts = useMemo(() => {
    const counts = new Map();
    families.forEach((family) => {
      (family.colorNames || []).forEach((colorName) => {
        const norm = normalizeColorName(colorName);
        if (!norm) return;
        counts.set(norm, (counts.get(norm) || 0) + 1);
      });
    });
    return counts;
  }, [families]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = swatches;
    if (term) {
      list = list.filter((swatch) => {
        const aliases = Array.isArray(swatch.aliases) ? swatch.aliases : [];
        return (
          swatch.name?.toLowerCase().includes(term) ||
          aliases.some((alias) => alias.toLowerCase().includes(term))
        );
      });
    }
    switch (sort) {
      case "updated":
        return [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      case "usage":
        return [...list].sort(
          (a, b) =>
            (usageCounts.get(normalizeColorName(b.name)) || 0) -
            (usageCounts.get(normalizeColorName(a.name)) || 0)
        );
      default:
        return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
  }, [swatches, search, sort, usageCounts]);

  const getDraft = (colorKey) => drafts[colorKey] || { ...emptyDraft, name: swatches.find((s) => s.colorKey === colorKey)?.name || "" };

  const updateDraft = (colorKey, updates) => {
    setDrafts((prev) => ({
      ...prev,
      [colorKey]: { ...getDraft(colorKey), ...updates },
    }));
  };

  const resetDraft = (colorKey) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[colorKey];
      return next;
    });
  };

  const handleFileChange = (colorKey, file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    updateDraft(colorKey, { file, previewUrl: url });
  };

  const handleSave = async (colorKey) => {
    if (!canEdit) return;
    const original = swatches.find((s) => s.colorKey === colorKey);
    const draft = getDraft(colorKey);
    const name = (draft.name || original?.name || "").trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const hexColor = draft.hexColor?.trim() || original?.hexColor || null;
    if (hexColor && !isValidHexColor(hexColor)) {
      toast.error("Hex must be in #RRGGBB format");
      return;
    }
    setSavingKey(colorKey);
    try {
      await upsertColorSwatch({
        db,
        clientId,
        name,
        hexColor: hexColor || null,
        aliases: normaliseAliases(draft.aliases || (original?.aliases || []).join(", ")),
        swatchImageFile: draft.file || null,
        swatchImagePath: original?.swatchImagePath || null,
      });
      toast.success(`Saved ${name}`);
      resetDraft(colorKey);
    } catch (error) {
      console.error("Failed to save swatch", error);
      toast.error(error?.message || "Unable to save swatch");
    } finally {
      setSavingKey(null);
    }
  };

  const handleDelete = async (swatch) => {
    if (!canEdit) return;
    const usage = usageCounts.get(normalizeColorName(swatch.name)) || 0;
    if (usage > 0) {
      toast.error("Swatch is in use by products. Relink SKUs before deleting.");
      return;
    }
    setSavingKey(swatch.colorKey);
    try {
      await deleteColorSwatch({
        db,
        clientId,
        colorKey: swatch.colorKey,
        swatchImagePath: swatch.swatchImagePath,
      });
      toast.success(`Deleted ${swatch.name}`);
      resetDraft(swatch.colorKey);
    } catch (error) {
      console.error("Failed to delete swatch", error);
      toast.error(error?.message || "Unable to delete swatch");
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreate = async () => {
    if (!canEdit) return;
    const name = newDraft.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    if (newDraft.hexColor && !isValidHexColor(newDraft.hexColor)) {
      toast.error("Hex must be in #RRGGBB format");
      return;
    }
    setSavingKey("new");
    try {
      await upsertColorSwatch({
        db,
        clientId,
        name,
        hexColor: newDraft.hexColor || null,
        aliases: normaliseAliases(newDraft.aliases),
        swatchImageFile: newDraft.file || null,
      });
      toast.success(`Created ${name}`);
      setNewDraft(emptyDraft);
    } catch (error) {
      console.error("Failed to create swatch", error);
      toast.error(error?.message || "Unable to create swatch");
    } finally {
      setSavingKey(null);
    }
  };

  const handleSeed = useCallback(async () => {
    if (!clientId || !canEdit) return;
    setSeeding(true);
    try {
      const seen = new Map();

      // First pass: use already-loaded families (colorNames) to avoid extra permission failures.
      families.forEach((family) => {
        (family.colorNames || []).forEach((name) => {
          const norm = normalizeColorName(name);
          if (!norm) return;
          if (paletteIndex?.byName?.has(norm)) return;
          if (!seen.has(norm)) {
            seen.set(norm, { name, hexColor: null });
          }
        });
      });

      // Optional best-effort: load SKUs for hex if allowed. If blocked, skip quietly.
      for (const family of families) {
        try {
          const skusSnap = await getDocs(collection(db, ...productFamilySkusPath(family.id, clientId)));
          skusSnap.forEach((skuDoc) => {
            const sku = skuDoc.data();
            const name = sku.colorName || "";
            const norm = normalizeColorName(name);
            if (!norm) return;
            if (paletteIndex?.byName?.has(norm)) return;
            if (seen.has(norm) && seen.get(norm)?.hexColor) return;
            const hex = isValidHexColor(sku.hexColor) ? sku.hexColor : null;
            seen.set(norm, { name: sku.colorName, hexColor: hex });
          });
        } catch (err) {
          // If permissions block SKU reads, continue with family color names only.
          continue;
        }
      }

      let created = 0;
      for (const { name, hexColor } of seen.values()) {
        await upsertColorSwatch({
          db,
          clientId,
          name,
          hexColor: hexColor || null,
        });
        created += 1;
      }
      toast.success(created ? `Seeded ${created} swatch${created === 1 ? "" : "es"} from products` : "No new swatches to seed");
    } catch (error) {
      console.error("Failed to seed palette", error);
      if (error?.code === "permission-denied") {
        toast.error("Insufficient permissions to create swatches. Please check Firestore rules or use an account with product edit rights.");
      } else {
        toast.error(error?.message || "Unable to seed palette");
      }
    } finally {
      setSeeding(false);
    }
  }, [clientId, canEdit, paletteIndex, families]);

  const renderRow = (swatch) => {
    const draft = getDraft(swatch.colorKey);
    const currentHex = draft.hexColor || swatch.hexColor || "";
    const usage = usageCounts.get(normalizeColorName(swatch.name)) || 0;
    return (
      <tr key={swatch.colorKey} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
        <td className="px-4 py-3 align-middle">
          <Input
            value={draft.name || swatch.name || ""}
            onChange={(e) => updateDraft(swatch.colorKey, { name: e.target.value })}
            disabled={!canEdit}
          />
          <div className="mt-1 text-xs text-slate-500">Key: {swatch.colorKey}</div>
        </td>
        <td className="px-4 py-3 align-middle">
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-full border border-slate-300 dark:border-slate-700"
              style={{ backgroundColor: currentHex || "#CBD5E1" }}
              title={currentHex || "No hex"}
            />
            <Input
              value={currentHex}
              placeholder="#RRGGBB"
              onChange={(e) => updateDraft(swatch.colorKey, { hexColor: e.target.value.toUpperCase() })}
              disabled={!canEdit}
              className="w-28 font-mono text-sm"
            />
          </div>
        </td>
        <td className="px-4 py-3 align-middle">
          <div className="flex items-center gap-2">
            {draft.previewUrl ? (
              <AppImage
                src={draft.previewUrl}
                alt=""
                className="h-12 w-12 overflow-hidden rounded border border-slate-200"
                imageClassName="h-full w-full object-cover"
                placeholder={null}
                fallback={null}
              />
            ) : swatch.swatchImagePath ? (
              <AppImage
                src={swatch.swatchImagePath}
                alt=""
                className="h-12 w-12 overflow-hidden rounded border border-slate-200"
                imageClassName="h-full w-full object-cover"
                placeholder={null}
                fallback={null}
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-slate-300 text-xs text-slate-500">
                None
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              disabled={!canEdit}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileChange(swatch.colorKey, file);
                e.target.value = "";
              }}
            />
          </div>
        </td>
        <td className="px-4 py-3 align-middle">
          <Input
            value={draft.aliases || (swatch.aliases || []).join(", ")}
            onChange={(e) => updateDraft(swatch.colorKey, { aliases: e.target.value })}
            disabled={!canEdit}
            placeholder="Comma-separated"
          />
        </td>
        <td className="px-4 py-3 align-middle text-center text-sm text-slate-600 dark:text-slate-300">
          {usage}
        </td>
        <td className="px-4 py-3 align-middle">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => handleSave(swatch.colorKey)}
              disabled={!canEdit || savingKey === swatch.colorKey}
            >
              {savingKey === swatch.colorKey ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => resetDraft(swatch.colorKey)}
              disabled={!canEdit}
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => handleDelete(swatch)}
              disabled={!canEdit || savingKey === swatch.colorKey}
            >
              Delete
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4 px-4">
      <PageHeader>
        <PageHeader.Content>
          <div>
            <PageHeader.Title>Palette</PageHeader.Title>
            <PageHeader.Description>Standardize color swatches across products.</PageHeader.Description>
          </div>
          <PageHeader.Actions>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search names or aliases"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-60"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="name">Name (A→Z)</option>
                <option value="updated">Recently updated</option>
                <option value="usage">Usage count</option>
              </select>
              <Button type="button" onClick={handleSeed} disabled={!canEdit || seeding}>
                {seeding ? "Seeding…" : "Seed from products"}
              </Button>
            </div>
          </PageHeader.Actions>
        </PageHeader.Content>
      </PageHeader>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Add swatch</h3>
              <p className="text-sm text-slate-500">Name, optional hex, optional texture image.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Name"
                value={newDraft.name}
                onChange={(e) => setNewDraft((prev) => ({ ...prev, name: e.target.value }))}
                className="w-40"
              />
              <Input
                placeholder="#RRGGBB"
                value={newDraft.hexColor}
                onChange={(e) => setNewDraft((prev) => ({ ...prev, hexColor: e.target.value.toUpperCase() }))}
                className="w-28 font-mono text-sm"
              />
              <Input
                placeholder="Aliases (comma separated)"
                value={newDraft.aliases}
                onChange={(e) => setNewDraft((prev) => ({ ...prev, aliases: e.target.value }))}
                className="w-60"
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    setNewDraft((prev) => ({ ...prev, file, previewUrl: url }));
                  }
                  e.target.value = "";
                }}
              />
              <Button type="button" onClick={handleCreate} disabled={!canEdit || savingKey === "new"}>
                {savingKey === "new" ? "Saving…" : "Create"}
              </Button>
            </div>
          </div>
          {newDraft.previewUrl && (
            <div className="mt-2 flex items-center gap-2">
              <div className="text-xs text-slate-500">Preview:</div>
              <AppImage
                src={newDraft.previewUrl}
                alt=""
                className="h-12 w-12 overflow-hidden rounded border border-slate-200"
                imageClassName="h-full w-full object-cover"
                placeholder={null}
                fallback={null}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setNewDraft((prev) => ({ ...prev, file: null, previewUrl: null }))}
              >
                Remove
              </Button>
            </div>
          )}
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No swatches yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Hex</th>
                    <th className="px-4 py-3">Texture</th>
                    <th className="px-4 py-3">Aliases</th>
                    <th className="px-4 py-3 text-center">Usage</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>{filtered.map(renderRow)}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
