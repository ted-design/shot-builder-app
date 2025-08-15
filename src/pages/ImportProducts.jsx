import Papa from "papaparse";
import {
  addDoc,
  setDoc,
  doc as d,
  collection as coll,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { CLIENT_ID, productsPath } from "../lib/paths";
import { useState } from "react";

/**
 * ImportProducts
 *
 * A simple importer for bulk creating product documents from a CSV.  The
 * expected input columns are:
 *   sku       – unique identifier, used as the Firestore document ID
 *   gender    – Men, Women or Unisex
 *   product   – full product name (e.g. "Men's Ultra Merino Crew T‑Shirt")
 *   color
 *   size
 *
 * The importer will normalise gender (case‑insensitive), strip leading
 * "Men's"/"Women's" from the product name, and filter out disallowed
 * products such as gift cards or packaging.  Each valid row will be
 * written to `clients/{CLIENT_ID}/products/{sku}`.  When `useSkuAsId`
 * is disabled, documents are created with a generated ID.
 */
export default function ImportProducts() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [useSkuAsId, setUseSkuAsId] = useState(true);

  // Handle file upload and parse CSV data
  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => setRows(data),
    });
  }

  // Basic helpers for normalising and filtering
  const disallowed = [
    "gift card",
    "digital gift card",
    "duster bag",
    "ddp cost",
    "packaging",
  ];

  function normaliseGender(g) {
    if (!g) return "Unisex";
    const val = String(g).trim().toLowerCase();
    if (val.startsWith("men")) return "Men";
    if (val.startsWith("women")) return "Women";
    return "Unisex";
  }

  function stripGenderPrefix(name) {
    if (!name) return "";
    let n = String(name).trim();
    // Remove leading "Men's", "Men", "Women's" etc.
    n = n.replace(/^men['s]*\s+/i, "");
    n = n.replace(/^women['s]*\s+/i, "");
    return n;
  }

  function shouldSkip(product) {
    if (!product) return true;
    const n = String(product).toLowerCase();
    return disallowed.some((bad) => n.includes(bad));
  }

  // Perform the import
  async function runImport() {
    if (!rows.length) {
      setStatus("No rows parsed.");
      return;
    }
    setStatus("Importing…");
    const colRef = coll(db, ...productsPath);
    let ok = 0;
    let fail = 0;

    for (const r of rows) {
      try {
        const sku = (r.sku || "").trim();
        const rawGender = (r.gender || "").trim();
        const rawName = (r.product || "").trim();
        const color = (r.color || "").trim();
        const size = (r.size || "").trim();

        // Validate required fields
        if (!sku || !rawName) {
          fail++;
          continue;
        }

        // Filter disallowed products
        if (shouldSkip(rawName)) {
          continue;
        }

        const gender = normaliseGender(rawGender);
        const name = stripGenderPrefix(rawName);

        const record = {
          sku,
          gender,
          name,
          color,
          size,
          clientId: CLIENT_ID,
          createdAt: new Date().toISOString(),
        };

        if (useSkuAsId) {
          await setDoc(d(db, ...productsPath, sku), record, { merge: true });
        } else {
          await addDoc(colRef, record);
        }
        ok++;
      } catch (err) {
        console.error(err);
        fail++;
      }
    }
    setStatus(`Done. Imported: ${ok}, Failed: ${fail}`);
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Import Products (CSV)</h1>
      <p className="text-sm text-gray-600">
        CSV headers required: <code>sku</code>, <code>gender</code>,
        <code>product</code>, <code>color</code>, <code>size</code>. Gender and
        product are used to normalise names. All other columns will be
        ignored. Products containing “Gift Card”, “Duster bag”, “DDP Cost”
        or “Packaging” will be skipped.
      </p>
      <input
        type="file"
        accept=".csv"
        onChange={onFile}
        className="border p-2 rounded-lg"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={useSkuAsId}
          onChange={(e) => setUseSkuAsId(e.target.checked)}
        />
        Use <code>sku</code> as document ID
      </label>
      <button
        className="rounded-lg px-4 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
        onClick={runImport}
        disabled={!rows.length}
      >
        Import {rows.length ? `(${rows.length})` : ""}
      </button>
      <div className="text-sm">{status}</div>
    </div>
  );
}