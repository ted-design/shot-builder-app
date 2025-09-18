// src/pages/ImportProducts.jsx
import React, { useState } from "react";
import { db } from "../lib/firebase";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import {
  productFamiliesPath,
  productFamilyPath,
  productFamilySkuPath,
  productFamilySkusPath,
} from "../lib/paths";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Input, Checkbox } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { canEditProducts, ROLE } from "../lib/rbac";

/** Utility: robust CSV parser for simple, comma-separated files with quoted fields. */
function parseCSV(text) {
  const rows = [];
  let i = 0, field = "", row = [], inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { rows.push(row); row = []; };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { pushField(); i++; continue; }
    if (c === "\n" || c === "\r") {
      // Handle CRLF/CR
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushField(); pushRow(); i++; continue;
    }
    field += c; i++;
  }
  // flush last field/row
  if (field.length || row.length) { pushField(); pushRow(); }

  // Convert to array of objects using header row
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => (h || "").trim());
  return rows.slice(1).map(cols => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (cols[idx] || "").trim(); });
    return obj;
  });
}

/** Safer gender prefix removal: removes only a leading “Men's ” or “Women's ”, case-insensitive. */
function stripGenderPrefix(name) {
  if (!name) return name;
  return name.replace(/^(men's\s+|women's\s+)/i, "");
}

export default function ImportProducts() {
  const [status, setStatus] = useState("Awaiting file upload...");
  const [rows, setRows] = useState([]);
  const [useStyleNumberAsId, setUseStyleNumberAsId] = useState(true);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const { role: globalRole } = useAuth();
  const role = globalRole || ROLE.VIEWER;
  const canManage = canEditProducts(role);

  const onFile = async (e) => {
    if (!canManage) {
      alert("You do not have permission to import products.");
      return;
    }
    const f = e.target.files?.[0];
    if (!f) return;
    setStatus("Parsing CSV...");
    const text = await f.text();
    const parsed = parseCSV(text);
    setRows(parsed);
    setTotal(parsed.length);
    setProgress(0);
    setStatus(`Parsed ${parsed.length} rows. Ready to import.`);
  };

  const normaliseGender = (value) => {
    if (!value) return null;
    const lower = value.trim().toLowerCase();
    if (lower.startsWith("men")) return "men";
    if (lower.startsWith("women")) return "women";
    if (lower === "unisex") return "unisex";
    return lower || null;
  };

  const buildSkuEntries = (group) => {
    const entries = [];
    group.colorways.forEach((sizeMap, colourName) => {
      sizeMap.forEach((info, sizeValue) => {
        const skuCode = (info && info.sku ? info.sku.trim() : "");
        if (!skuCode) return;
        const sizes = sizeValue ? [sizeValue] : [];
        entries.push({
          colorName: colourName || "Default",
          skuCode,
          sizes,
          status: "active",
          oldSku: info?.oldSku || null,
        });
      });
    });
    return entries;
  };

  async function importRows() {
    if (!canManage || !rows.length) return;
    setLoading(true);
    setStatus("Importing product families…");
    setProgress(0);

    const groups = new Map();

    rows.forEach((r) => {
      const genderRaw = (r.gender || r.Gender || "").trim();
      const styleName = stripGenderPrefix((r["STYLE NAME"] || r["Style Name"] || r.product || r.Product || r.name || "").trim());
      const styleNumber = (r["CURRENT STYLE #"] || r["Style Number"] || r.style_number || r.styleNumber || "").trim();
      const previousStyle = (r["PREVIOUS STYLE #"] || r.previousStyleNumber || "").trim();
      const colorway = (r.COLORWAY || r.Colorway || r["COLOR WAY"] || r.Color || "").trim();
      const size = (r.SIZE || r.Size || "").trim();
      const newSku = (r["NEW SKU #"] || r["New SKU"] || r.sku || r.SKU || "").trim();
      const oldSku = (r["OLD SKU #"] || r["Old SKU"] || r.oldSku || "").trim();

      if (!styleName || !styleNumber || !newSku) {
        return;
      }

      if (!groups.has(styleNumber)) {
        groups.set(styleNumber, {
          name: styleName,
          styleNumber,
          gender: normaliseGender(genderRaw),
          previousStyleNumber: previousStyle || null,
          category: (r.category || r.Category || "").trim() || null,
          colorways: new Map(),
        });
      }
      const group = groups.get(styleNumber);
      const colourKey = colorway || "Default";
      if (!group.colorways.has(colourKey)) {
        group.colorways.set(colourKey, new Map());
      }
      const sizeMap = group.colorways.get(colourKey);
      sizeMap.set(size || "", { sku: newSku, oldSku: oldSku || null });
    });

    const grouped = Array.from(groups.values());
    setTotal(grouped.length);

    const familiesCollection = collection(db, ...productFamiliesPath);
    let imported = 0;
    let errors = 0;

    for (const group of grouped) {
      try {
        const familyRef = useStyleNumberAsId && group.styleNumber
          ? doc(db, ...productFamilyPath(group.styleNumber))
          : doc(familiesCollection);
        const familyId = familyRef.id;
        const now = Date.now();
        const existingSnap = await getDoc(familyRef);
        const existingData = existingSnap.exists() ? existingSnap.data() : null;

        const skuEntries = buildSkuEntries(group);
        const skuCodes = Array.from(new Set(skuEntries.map((entry) => entry.skuCode).filter(Boolean)));
        const colorNames = Array.from(new Set(skuEntries.map((entry) => entry.colorName).filter(Boolean)));
        const sizeOptions = Array.from(new Set(skuEntries.flatMap((entry) => entry.sizes).filter(Boolean)));
        const activeSkuCount = skuEntries.filter((entry) => entry.status === "active").length;

        const familyData = {
          styleName: group.name,
          styleNumber: group.styleNumber,
          previousStyleNumber: group.previousStyleNumber || existingData?.previousStyleNumber || null,
          gender: group.gender || existingData?.gender || null,
          category: group.category || existingData?.category || null,
          status: existingData?.status || "active",
          archived: existingData?.archived || false,
          notes: existingData?.notes || [],
          headerImagePath: existingData?.headerImagePath || null,
          shotIds: existingData?.shotIds || [],
          skuCodes,
          colorNames,
          sizeOptions,
          skuCount: skuEntries.length,
          activeSkuCount,
          createdAt: existingData?.createdAt || now,
          updatedAt: now,
        };

        await setDoc(familyRef, familyData, { merge: true });

        const existingSkus = await getDocs(collection(db, ...productFamilySkusPath(familyId)));
        for (const docSnap of existingSkus.docs) {
          await deleteDoc(doc(db, ...productFamilySkuPath(familyId, docSnap.id)));
        }

        for (const entry of skuEntries) {
          const skuRef = doc(collection(db, ...productFamilySkusPath(familyId)));
          await setDoc(skuRef, {
            colorName: entry.colorName,
            skuCode: entry.skuCode,
            sizes: entry.sizes,
            status: entry.status,
            archived: false,
            imagePath: null,
            oldSku: entry.oldSku || null,
            createdAt: now,
            updatedAt: now,
          });
        }

        imported += 1;
        setProgress(imported);
        setStatus(`Imported ${imported} / ${grouped.length} families`);
      } catch (err) {
        console.error("Failed to import product family", err);
        errors += 1;
        setStatus(`Error importing ${group.styleNumber || group.name}: ${err?.message || err}`);
      }
    }

    setLoading(false);
    setStatus(
      `Done. Imported ${imported} families${errors ? ` with ${errors} error${errors === 1 ? "" : "s"}.` : "."}`
    );
  }

  const pct = total ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Import products</h1>
        <p className="text-sm text-slate-600">
          Upload CSV files to seed product families and SKUs. Future iterations will relocate
          this flow into the Products section.
        </p>
      </div>
      {canManage ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Import Products</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="file" accept=".csv" onChange={onFile} />
            <div className="flex items-center gap-2">
              <Checkbox
                checked={useStyleNumberAsId}
                onChange={(e) => setUseStyleNumberAsId(e.target.checked)}
              />
              <span className="text-sm text-gray-700">Use style number as document ID</span>
            </div>

            <div className="text-sm text-gray-600">{status}</div>

            {(loading || progress > 0) && total > 0 && (
              <div className="space-y-2">
                <progress value={progress} max={total} className="w-full" />
                <div className="text-xs text-gray-500">{progress} / {total} ({pct}%)</div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={importRows} disabled={!rows.length || loading}>
                {loading ? "Importing..." : "Start Import"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Product import is restricted to producers or admins. Reach out to the team if you need
          elevated access.
        </div>
      )}
    </div>
  );
}
