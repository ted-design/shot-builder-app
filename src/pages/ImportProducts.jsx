import { useState } from "react";
// Note: We removed the external papaparse dependency in favour of a simple CSV parser.
// parseCSV splits CSV lines into objects with headers; it handles quoted fields with commas.
function parseCSV(text) {
  const rows = [];
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return rows;
  // Use regex to split by comma not enclosed in quotes
  const splitter = /,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/;
  const headers = lines[0].split(splitter).map((h) => h.trim().replace(/^\"|\"$/g, ""));
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(splitter).map((c) => c.trim().replace(/^\"|\"$/g, ""));
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}
import {
  collection,
  setDoc,
  addDoc,
  doc as d,
  writeBatch,
} from "firebase/firestore";
// Import Firestore instance from the concrete Firebase config.  The
// `lib/firebase` module expects environment variables; using the root
// config ensures API keys are available.
import { db } from "../firebase";
import { CLIENT_ID, productsPath } from "../lib/paths";
// Import simple UI primitives from our local implementation instead of using an
// alias.  These components live under src/components/ui.
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

/**
 * ImportProductsPolished
 *
 * A polished importer component for bulk creating product documents from a CSV.
 * It expects the following columns: sku, gender, product, color and size.
 * The importer normalises gender, strips leading gender from the product name
 * and filters out disallowed products (gift cards, packaging, etc.).  Rows
 * with missing SKU or missing name are ignored.  The Firestore document
 * location is `clients/{CLIENT_ID}/products/{sku}` when `useSkuAsId` is
 * enabled; otherwise a generated ID is used.  Progress and status are
 * displayed to the user.
 */
export default function ImportProducts() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("Awaiting file upload...");
  const [useSkuAsId, setUseSkuAsId] = useState(true);
  const [loading, setLoading] = useState(false);
  // Track progress of import. `progress` is the number of rows imported so far.
  // `total` is set when the CSV is parsed to the total number of rows.
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  // Called when the user selects a CSV file
  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Parsing CSV...");
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result || "";
        const data = parseCSV(String(text));
        setRows(data);
        setStatus(`${data.length} rows parsed. Ready to import.`);
        // initialise progress tracking
        setTotal(data.length);
        setProgress(0);
      } catch (err) {
        console.error(err);
        setStatus("Failed to parse CSV");
      }
    };
    reader.onerror = () => {
      setStatus("Failed to read file");
    };
    reader.readAsText(file);
  }

  // Helpers for normalising and filtering
  const disallowed = [
    "gift card",
    "digital gift card",
    "duster bag",
    "ddp cost",
    "packaging",
  ];
  const stripGenderPrefix = (name) => {
    const lc = name.toLowerCase();
    // Remove gender prefixes, preserving the first letter of the product name.
    // "Men's " is 6 characters (M e n ' s and space).  Using slice(6) keeps the first
    // character of the actual name.  Similarly, "Women's " is 8 characters.
    if (lc.startsWith("men's ")) return name.slice(6);
    if (lc.startsWith("women's ")) return name.slice(8);
    return name;
  };
  const normaliseGender = (g) => {
    const lc = (g || "").toLowerCase();
    if (lc.startsWith("m")) return "Men";
    if (lc.startsWith("w")) return "Women";
    return "Unisex";
  };
  const isAllowed = (productName) => {
    const lc = productName.toLowerCase();
    return !disallowed.some((bad) => lc.includes(bad));
  };

  // Import all rows to Firestore
  async function importRows() {
    if (!rows.length) return;
    setLoading(true);
    setStatus("Importing products...");
    setProgress(0);
    // Pre-filter rows to avoid counting skipped rows in total
    const validRows = [];
    for (const row of rows) {
      const skuValue = (row.sku || "").trim();
      const productName = (row.product || row.name || "").trim();
      if (!skuValue || !productName) continue;
      if (!isAllowed(productName)) continue;
      validRows.push(row);
    }
    // Reset total based on valid rows
    setTotal(validRows.length);
    let imported = 0;
    const BATCH_SIZE = 50;
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const chunk = validRows.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const row of chunk) {
        const sku = (row.sku || "").trim();
        const productName = (row.product || row.name || "").trim();
        const docId = useSkuAsId ? sku : undefined;
        const productData = {
          gender: normaliseGender(row.gender),
          name: stripGenderPrefix(productName),
          color: (row.color || row.colour || "").trim(),
          size: (row.size || "").trim(),
          sku,
        };
        let docRef;
        if (docId) {
          // When a SKU is used as the document ID, build the path relative to the root Firestore instance.
          docRef = d(db, ...productsPath, docId);
        } else {
          // Create a new document with a generated ID within the products collection.
          const colRef = collection(db, ...productsPath);
          docRef = d(colRef);
        }
        batch.set(docRef, productData, { merge: true });
      }
      try {
        await batch.commit();
        imported += chunk.length;
        setProgress(imported);
      } catch (err) {
        console.error("Error committing batch", err);
      }
    }
    setLoading(false);
    setStatus(`${imported} products imported successfully.`);
  }

  return (
    <div className="p-4 space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Import Products</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept=".csv" onChange={onFile} />
          <div className="flex items-center space-x-2">
            <input
              id="useSkuAsId"
              type="checkbox"
              checked={useSkuAsId}
              onChange={(e) => setUseSkuAsId(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="useSkuAsId" className="text-sm">
              Use SKU as document ID
            </label>
          </div>
          <Button onClick={importRows} disabled={loading || !rows.length}>
            {loading ? "Importing..." : "Import"}
          </Button>
          {/* Show a progress bar while importing */}
          {loading && total > 0 && (
            <div className="space-y-1">
              <progress value={progress} max={total} className="w-full h-2" />
              <p className="text-xs text-gray-600">
                {progress}/{total} imported
              </p>
            </div>
          )}
          <p className="text-sm text-gray-600">{status}</p>
        </CardContent>
      </Card>
    </div>
  );
}