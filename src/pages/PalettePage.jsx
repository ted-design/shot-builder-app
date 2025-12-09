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
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "../lib/toast";
import AppImage from "../components/common/AppImage";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { PageHeader } from "../components/ui/PageHeader";
import { MoreVertical, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import SwatchCreateModal from "../components/palette/SwatchCreateModal";
import SwatchEditModal from "../components/palette/SwatchEditModal";
import ConfirmDialog from "../components/common/ConfirmDialog";

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

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSwatch, setEditingSwatch] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [swatchToDelete, setSwatchToDelete] = useState(null);
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

  const handleCreate = async (draft) => {
    if (!canEdit) return;

    const name = draft.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }

    if (draft.hexColor && !isValidHexColor(draft.hexColor)) {
      toast.error("Hex must be in #RRGGBB format");
      return;
    }

    setSavingKey("new");
    try {
      await upsertColorSwatch({
        db,
        clientId,
        name,
        hexColor: draft.hexColor || null,
        aliases: normaliseAliases(draft.aliases),
        swatchImageFile: draft.file || null,
      });
      toast.success(`Created ${name}`);
      setCreateModalOpen(false);
    } catch (error) {
      console.error("Failed to create swatch", error);
      toast.error(error?.message || "Unable to create swatch");
    } finally {
      setSavingKey(null);
    }
  };

  const handleEdit = async (draft) => {
    if (!canEdit || !editingSwatch) return;

    const name = draft.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }

    const hexColor = draft.hexColor?.trim() || null;
    if (hexColor && !isValidHexColor(hexColor)) {
      toast.error("Hex must be in #RRGGBB format");
      return;
    }

    setSavingKey(editingSwatch.colorKey);
    try {
      await upsertColorSwatch({
        db,
        clientId,
        name,
        hexColor: hexColor || null,
        aliases: normaliseAliases(draft.aliases),
        swatchImageFile: draft.file || null,
        swatchImagePath: editingSwatch.swatchImagePath || null,
      });
      toast.success(`Saved ${name}`);
      setEditModalOpen(false);
      setEditingSwatch(null);
    } catch (error) {
      console.error("Failed to save swatch", error);
      toast.error(error?.message || "Unable to save swatch");
    } finally {
      setSavingKey(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!canEdit || !swatchToDelete) return;

    const usage = usageCounts.get(normalizeColorName(swatchToDelete.name)) || 0;
    if (usage > 0) {
      toast.error("Swatch is in use by products. Relink SKUs before deleting.");
      setDeleteConfirmOpen(false);
      setSwatchToDelete(null);
      return;
    }

    setSavingKey(swatchToDelete.colorKey);
    try {
      await deleteColorSwatch({
        db,
        clientId,
        colorKey: swatchToDelete.colorKey,
        swatchImagePath: swatchToDelete.swatchImagePath,
      });
      toast.success(`Deleted ${swatchToDelete.name}`);
      setDeleteConfirmOpen(false);
      setSwatchToDelete(null);
    } catch (error) {
      console.error("Failed to delete swatch", error);
      toast.error(error?.message || "Unable to delete swatch");
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

  const openEditModal = (swatch) => {
    setEditingSwatch(swatch);
    setEditModalOpen(true);
  };

  const handleDeleteFromModal = (swatch) => {
    setSwatchToDelete(swatch);
    setDeleteConfirmOpen(true);
  };

  const renderRow = (swatch) => {
    const currentHex = swatch.hexColor || "";
    const usage = usageCounts.get(normalizeColorName(swatch.name)) || 0;
    const isSaving = savingKey === swatch.colorKey;

    return (
      <tr key={swatch.colorKey} className="border-b border-slate-100 last:border-0 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
        {/* Actions Menu */}
        <td className="px-4 py-3 align-middle">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                disabled={!canEdit || isSaving}
                aria-label="Actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => openEditModal(swatch)}>
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>

        {/* Name */}
        <td className="px-4 py-3 align-middle">
          <div className="font-medium text-slate-900 dark:text-slate-100">{swatch.name}</div>
          <div className="mt-0.5 text-xs text-slate-500">Key: {swatch.colorKey}</div>
        </td>

        {/* Hex Color */}
        <td className="px-4 py-3 align-middle">
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-full border border-slate-300 dark:border-slate-700 flex-shrink-0"
              style={{ backgroundColor: currentHex || "#CBD5E1" }}
              title={currentHex || "No hex"}
            />
            <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
              {currentHex || "—"}
            </span>
          </div>
        </td>

        {/* Texture */}
        <td className="px-4 py-3 align-middle">
          {swatch.swatchImagePath ? (
            <AppImage
              src={swatch.swatchImagePath}
              alt={swatch.name}
              className="h-12 w-12 overflow-hidden rounded border border-slate-200 dark:border-slate-700"
              imageClassName="h-full w-full object-cover"
              placeholder={null}
              fallback={null}
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-slate-300 dark:border-slate-600 text-xs text-slate-500">
              None
            </div>
          )}
        </td>

        {/* Aliases */}
        <td className="px-4 py-3 align-middle">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {Array.isArray(swatch.aliases) && swatch.aliases.length > 0
              ? swatch.aliases.join(", ")
              : "—"}
          </div>
        </td>

        {/* Usage */}
        <td className="px-4 py-3 align-middle text-center">
          <span className="inline-flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            {usage}
          </span>
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
              <Button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                disabled={!canEdit}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Swatch
              </Button>
            </div>
          </PageHeader.Actions>
        </PageHeader.Content>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500">
                {search ? "No swatches match your search." : "No swatches yet."}
              </p>
              {!search && canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreateModalOpen(true)}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first swatch
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="w-12 px-4 py-3"></th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Hex</th>
                    <th className="px-4 py-3">Texture</th>
                    <th className="px-4 py-3">Aliases</th>
                    <th className="px-4 py-3 text-center">Usage</th>
                  </tr>
                </thead>
                <tbody>{filtered.map(renderRow)}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <SwatchCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSave={handleCreate}
        saving={savingKey === "new"}
      />

      {/* Edit Modal */}
      <SwatchEditModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingSwatch(null);
        }}
        onSave={handleEdit}
        onDelete={handleDeleteFromModal}
        swatch={editingSwatch}
        saving={savingKey === editingSwatch?.colorKey}
        usageCount={editingSwatch ? (usageCounts.get(normalizeColorName(editingSwatch.name)) || 0) : 0}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setSwatchToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Swatch"
        message={
          swatchToDelete
            ? `Are you sure you want to delete "${swatchToDelete.name}"? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={savingKey === swatchToDelete?.colorKey}
      />
    </div>
  );
}
