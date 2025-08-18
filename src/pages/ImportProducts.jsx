// src/pages/ImportProducts.jsx
import React, { useState } from "react";
import { db } from "../firebase";
import { collection, doc, writeBatch } from "firebase/firestore";
import { productsPath } from "../lib/paths";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Input, Checkbox } from "../components/ui/input";
import { Button } from "../components/ui/button";

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
  const [useSkuAsId, setUseSkuAsId] = useState(true);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  const onFile = async (e) => {
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

  async function importRows() {
    if (!rows.length) return;
    setLoading(true);
    setStatus("Importing products...");
    setProgress(0);

    // Prepare valid rows
    const valid = [];
    for (const r of rows) {
      const sku = (r.sku || r.SKU || "").trim();
      const name = stripGenderPrefix((r.product || r.name || r.Product || "").trim());
      if (!sku || !name) continue;
      valid.push({ sku, r, name });
    }
    setTotal(valid.length);

    // Batch in chunks of 50
    const chunkSize = 50;
    let imported = 0;
    for (let i = 0; i < valid.length; i += chunkSize) {
      const chunk = valid.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const it of chunk) {
        const { sku, name, r } = it;
        const data = {
          sku,
          name,
          category: (r.category || r.Category || "").trim() || null,
          color: (r.color || r.Color || "").trim() || null,
          size: (r.size || r.Size || "").trim() || null,
          gender: (r.gender || r.Gender || "").trim() || null,
          active: String(r.active || r.Active || "").toLowerCase() !== "discontinued",
          discontinued: String(r.active || r.Active || "").toLowerCase() === "discontinued",
          updatedAt: new Date().toISOString(),
        };
        const id = useSkuAsId ? sku : undefined;
        if (id) {
          const ref = doc(db, ...productsPath, id);
          batch.set(ref, data, { merge: true });
        } else {
          const col = collection(db, ...productsPath);
          const ref = doc(col); // auto-ID
          batch.set(ref, data, { merge: true });
        }
      }
      await batch.commit();
      imported += chunk.length;
      setProgress(imported);
      setStatus(`Imported ${imported} / ${valid.length}`);
    }

    setLoading(false);
    setStatus(`Done. Imported ${valid.length} products.`);
  }

  const pct = total ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="p-4 space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Import Products</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept=".csv" onChange={onFile} />
          <div className="flex items-center gap-2">
            <Checkbox checked={useSkuAsId} onChange={e => setUseSkuAsId(e.target.checked)} />
            <span className="text-sm text-gray-700">Use SKU as document ID</span>
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
    </div>
  );
}
