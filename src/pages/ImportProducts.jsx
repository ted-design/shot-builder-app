import { useState } from "react";
import Papa from "papaparse";
import {
  collection,
  setDoc,
  addDoc,
  doc as d,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { CLIENT_ID, productsPath } from "../lib/paths";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

  // Called when the user selects a CSV file
  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Parsing CSV...");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        setRows(data);
        setStatus(`${data.length} rows parsed. Ready to import.`);
      },
    });
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
    if (lc.startsWith("men's ")) return name.slice(7);
    if (lc.startsWith("women's ")) return name.slice(9);
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
    let imported = 0;
    for (const row of rows) {
      const sku = (row.sku || "").trim();
      const productName = (row.product || row.name || "").trim();
      if (!sku || !productName) continue;
      if (!isAllowed(productName)) continue;
      const docId = useSkuAsId ? sku : undefined;
      const productData = {
        gender: normaliseGender(row.gender),
        name: stripGenderPrefix(productName),
        color: (row.color || row.colour || "").trim(),
        size: (row.size || "").trim(),
        sku,
        // add any other fields here as needed
      };
      const docPath = docId
        ? d(...productsPath, docId)
        : undefined;
      try {
        if (docId) {
          await setDoc(docPath, productData, { merge: true });
        } else {
          await addDoc(collection(db, ...productsPath), productData);
        }
        imported++;
      } catch (err) {
        console.error("Error importing", sku, err);
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
          <p className="text-sm text-gray-600">{status}</p>
        </CardContent>
      </Card>
    </div>
  );
}