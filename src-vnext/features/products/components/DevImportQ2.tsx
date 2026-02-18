/**
 * DEV-ONLY: Q2-1 product import tool.
 * This file is temporary and should be removed after the import is complete.
 */
import { useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { db } from "@/shared/lib/firebase"
import { productFamiliesPath } from "@/shared/lib/paths"
import { createProductFamilyWithSkus } from "@/features/products/lib/productWrites"
import {
  createProductComment,
  createProductSample,
} from "@/features/products/lib/productWorkspaceWrites"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import type { ProductSampleStatus } from "@/shared/types"

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface ImportColorway {
  readonly colorName: string
  readonly recolorNote?: string
}

interface ImportProduct {
  readonly styleName: string
  readonly styleNumber: string
  readonly previousStyleNumber: string
  readonly gender: "men" | "women" | ""
  readonly colorways: ReadonlyArray<ImportColorway>
  readonly sampleStatus: ProductSampleStatus | null
  readonly launchDate: string
  readonly familyComments: ReadonlyArray<string>
  readonly sampleNotes: string
  readonly sampleTracking: string
  readonly sampleCarrier: string
}

const Q2_PRODUCTS: ReadonlyArray<ImportProduct> = [
  {
    styleName: "Men's Merino Knit Short Sleeve Polo",
    styleNumber: "M-TP-PL-1087",
    previousStyleNumber: "",
    gender: "men",
    colorways: [
      { colorName: "Black" },
      { colorName: "Tan" },
      { colorName: "Heather Azure" },
      { colorName: "Ivory" },
    ],
    sampleStatus: "arrived",
    launchDate: "Mar 1, 2026",
    familyComments: [],
    sampleNotes: "",
    sampleTracking: "",
    sampleCarrier: "",
  },
  {
    styleName: "Women's Fine Knit Merino Dress",
    styleNumber: "W-DR-DR-1084",
    previousStyleNumber: "",
    gender: "women",
    colorways: [{ colorName: "Black" }, { colorName: "Tan" }],
    sampleStatus: "arrived",
    launchDate: "Mar 2, 2026",
    familyComments: [],
    sampleNotes: "",
    sampleTracking: "",
    sampleCarrier: "",
  },
  {
    styleName: "Women's Fine Knit Merino Cardigan",
    styleNumber: "W-TP-SW-1082",
    previousStyleNumber: "",
    gender: "women",
    colorways: [
      { colorName: "Black" },
      { colorName: "Heather Azure" },
      { colorName: "Ivory" },
    ],
    sampleStatus: "arrived",
    launchDate: "Mar 2, 2026",
    familyComments: [],
    sampleNotes: "",
    sampleTracking: "",
    sampleCarrier: "",
  },
  {
    styleName: "Women's Long Sleeve Fine Knit Polo",
    styleNumber: "W-TP-PL-1078",
    previousStyleNumber: "",
    gender: "women",
    colorways: [
      { colorName: "Black" },
      { colorName: "Tan" },
      { colorName: "Heather Azure" },
      { colorName: "Ivory" },
    ],
    sampleStatus: "arrived",
    launchDate: "Mar 2, 2026",
    familyComments: [],
    sampleNotes: "",
    sampleTracking: "",
    sampleCarrier: "",
  },
  {
    styleName: "Women's Merino Knit T-Shirt",
    styleNumber: "W-TP-TS-1081",
    previousStyleNumber: "",
    gender: "women",
    colorways: [
      { colorName: "Black" },
      { colorName: "Ivory" },
      { colorName: "Tan" },
      { colorName: "Heather Azure" },
    ],
    sampleStatus: "arrived",
    launchDate: "Mar 2, 2026",
    familyComments: [],
    sampleNotes: "",
    sampleTracking: "",
    sampleCarrier: "",
  },
  {
    styleName: "Women's Merino Scoop Bralette",
    styleNumber: "W-IN-BR-1026",
    previousStyleNumber: "",
    gender: "women",
    colorways: [
      { colorName: "Black" },
      { colorName: "Sand", recolorNote: "Recolor to Mocha" },
      { colorName: "Sail Blue" },
    ],
    sampleStatus: "requested",
    launchDate: "Mar 10, 2026",
    familyComments: [
      "Pad inserts are removable. Straps are adjustable. (Black colorway)",
      "ETA TBC, could use 2ND PP sample.",
    ],
    sampleNotes: "",
    sampleTracking: "",
    sampleCarrier: "",
  },
  {
    styleName: "Women's Merino High Waist Bikini",
    styleNumber: "W-IN-UW-1025",
    previousStyleNumber: "",
    gender: "women",
    colorways: [
      { colorName: "Black" },
      { colorName: "Sand", recolorNote: "Recolor to Mocha" },
      { colorName: "Sail Blue" },
    ],
    sampleStatus: "arrived",
    launchDate: "Mar 10, 2026",
    familyComments: [
      "ETA TBC, could use 2ND PP sample.",
      "Samples are in PP area currently, DHL #6773936772",
    ],
    sampleNotes: "",
    sampleTracking: "6773936772",
    sampleCarrier: "DHL",
  },
  {
    styleName: "Men's Merino Travel Pants",
    styleNumber: "M-BT-PN-1032",
    previousStyleNumber: "",
    gender: "men",
    colorways: [
      { colorName: "Navy" },
      { colorName: "Sand" },
      { colorName: "Charcoal", recolorNote: "Recolor to Black" },
    ],
    sampleStatus: "requested",
    launchDate: "Apr 16, 2026",
    familyComments: [
      "An update on the Relaxed Merino Travel Pants. (Navy colorway)",
      "Could use PP sample.",
    ],
    sampleNotes: "",
    sampleTracking: "",
    sampleCarrier: "",
  },
  {
    styleName: "Men's Merino Travel Shorts",
    styleNumber: "M-BT-SH-1172",
    previousStyleNumber: "",
    gender: "men",
    colorways: [
      { colorName: "Charcoal", recolorNote: "Recolor to Black" },
      { colorName: "Desert Khaki" },
      { colorName: "Navy" },
    ],
    sampleStatus: "requested",
    launchDate: "May 15, 2026",
    familyComments: ["Could use PP sample."],
    sampleNotes: "",
    sampleTracking: "",
    sampleCarrier: "",
  },
  {
    styleName: "Men's Slim Merino Travel Pant",
    styleNumber: "M-BT-PN-1038",
    previousStyleNumber: "",
    gender: "men",
    colorways: [{ colorName: "Black" }, { colorName: "Charcoal" }],
    sampleStatus: "requested",
    launchDate: "Jun 15, 2026",
    familyComments: ["Could use PP sample."],
    sampleNotes: "",
    sampleTracking: "",
    sampleCarrier: "",
  },
  {
    styleName: "Women's Merino Knit Hoodie",
    styleNumber: "W-TP-HD-1067",
    previousStyleNumber: "UM2026-3025",
    gender: "women",
    colorways: [{ colorName: "Black" }, { colorName: "Heather Grey" }],
    sampleStatus: "in_transit",
    launchDate: "Jul 1, 2026",
    familyComments: ["ETA Feb 2nd"],
    sampleNotes: "",
    sampleTracking: "",
    sampleCarrier: "",
  },
  {
    styleName: "Men's Merino Knit Pullover Hoodie",
    styleNumber: "M-TP-HD-1074",
    previousStyleNumber: "UM2026-3018",
    gender: "men",
    colorways: [{ colorName: "Black" }, { colorName: "Heather Grey" }],
    sampleStatus: "arrived",
    launchDate: "Jul 1, 2026",
    familyComments: [],
    sampleNotes: "",
    sampleTracking: "",
    sampleCarrier: "",
  },
  {
    styleName: "Women's Merino Sweater Pant",
    styleNumber: "W-BT-PN-1068",
    previousStyleNumber: "UM2025-268",
    gender: "women",
    colorways: [{ colorName: "Black" }, { colorName: "Heather Grey" }],
    sampleStatus: "arrived",
    launchDate: "Jul 1, 2026",
    familyComments: [],
    sampleNotes: "",
    sampleTracking: "",
    sampleCarrier: "",
  },
  {
    styleName: "Men's Active Merino T-Shirt",
    styleNumber: "",
    previousStyleNumber: "",
    gender: "men",
    colorways: [{ colorName: "Ivory" }, { colorName: "Royal Blue" }],
    sampleStatus: null,
    launchDate: "Apr 5, 2026",
    familyComments: [],
    sampleNotes: "",
    sampleTracking: "",
    sampleCarrier: "",
  },
]

// ---------------------------------------------------------------------------
// Duplicate check
// ---------------------------------------------------------------------------

async function findExistingStyleNumbers(
  clientId: string,
): Promise<Set<string>> {
  const basePath = productFamiliesPath(clientId)
  const colRef = collection(db, basePath[0]!, ...basePath.slice(1))
  const snap = await getDocs(query(colRef, where("deleted", "==", false)))
  const existing = new Set<string>()
  snap.forEach((docSnap) => {
    const sn = docSnap.data().styleNumber
    if (typeof sn === "string" && sn.trim().length > 0) {
      existing.add(sn.trim().toUpperCase())
    }
  })
  return existing
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type LogEntry = {
  readonly text: string
  readonly variant: "info" | "success" | "error" | "skip"
}

export default function DevImportQ2() {
  const { clientId, user } = useAuth()
  const [existingSet, setExistingSet] = useState<Set<string> | null>(null)
  const [checking, setChecking] = useState(false)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [log, setLog] = useState<ReadonlyArray<LogEntry>>([])

  const addLog = (entry: LogEntry) =>
    setLog((prev) => [...prev, entry])

  const checkDuplicates = async () => {
    if (!clientId) return
    setChecking(true)
    try {
      const existing = await findExistingStyleNumbers(clientId)
      setExistingSet(existing)
      addLog({
        text: `Found ${existing.size} existing product style numbers in Firestore.`,
        variant: "info",
      })
    } catch (err) {
      addLog({
        text: `Error checking duplicates: ${err instanceof Error ? err.message : String(err)}`,
        variant: "error",
      })
    } finally {
      setChecking(false)
    }
  }

  const runImport = async () => {
    if (!clientId || !user?.uid) return
    setRunning(true)
    const userId = user.uid
    const userName = user.displayName ?? null
    const userAvatar = user.photoURL ?? null

    let created = 0
    let skipped = 0
    let errors = 0

    for (const product of Q2_PRODUCTS) {
      const snUpper = product.styleNumber.trim().toUpperCase()

      // Duplicate check
      if (snUpper && existingSet?.has(snUpper)) {
        addLog({
          text: `SKIP: "${product.styleName}" (${product.styleNumber}) — already exists.`,
          variant: "skip",
        })
        skipped += 1
        continue
      }

      try {
        // 1. Create product family + SKUs
        const familyId = await createProductFamilyWithSkus({
          clientId,
          userId,
          family: {
            styleName: product.styleName,
            styleNumber: product.styleNumber,
            previousStyleNumber: product.previousStyleNumber,
            gender: product.gender,
            productType: "",
            productSubcategory: "",
            status: "active",
            archived: false,
            sizesCsv: "",
            notes: "",
          },
          skus: product.colorways.map((cw) => ({
            colorName: cw.colorName,
            skuCode: "",
            sizesCsv: "",
            status: "active",
            archived: false,
          })),
        })

        addLog({
          text: `CREATED: "${product.styleName}" (${product.styleNumber || "no style #"}) → ${familyId}`,
          variant: "success",
        })

        // 2. Create sample record if status exists
        if (product.sampleStatus) {
          await createProductSample({
            clientId,
            familyId,
            userId,
            type: "shoot",
            status: product.sampleStatus,
            sizeRunCsv: "",
            carrier: product.sampleCarrier || null,
            tracking: product.sampleTracking || null,
            notes: product.sampleNotes || null,
          })
          addLog({
            text: `  Sample: ${product.sampleStatus}${product.sampleTracking ? ` (tracking: ${product.sampleTracking})` : ""}`,
            variant: "info",
          })
        }

        // 3. Create launch date comment
        if (product.launchDate) {
          await createProductComment({
            clientId,
            familyId,
            body: `Launch date: ${product.launchDate}`,
            userId,
            userName,
            userAvatar,
          })
        }

        // 4. Create family-level comments from spreadsheet
        for (const comment of product.familyComments) {
          await createProductComment({
            clientId,
            familyId,
            body: comment,
            userId,
            userName,
            userAvatar,
          })
        }

        // 5. Create recolor notes as comments
        for (const cw of product.colorways) {
          if (cw.recolorNote) {
            await createProductComment({
              clientId,
              familyId,
              body: `${cw.colorName}: ${cw.recolorNote}`,
              userId,
              userName,
              userAvatar,
            })
          }
        }

        created += 1
      } catch (err) {
        addLog({
          text: `ERROR: "${product.styleName}" — ${err instanceof Error ? err.message : String(err)}`,
          variant: "error",
        })
        errors += 1
      }
    }

    addLog({
      text: `\nDone. Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`,
      variant: created > 0 ? "success" : "info",
    })
    setDone(true)
    setRunning(false)
  }

  const statusColor: Record<string, string> = {
    arrived: "text-green-600",
    requested: "text-amber-600",
    in_transit: "text-blue-600",
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-xl font-bold text-[var(--color-text)]">
          Q2-1 Product Import
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Import 14 product families (39 colorways) from the Q2-1 shoot brief.
          This is a dev-only tool — remove after use.
        </p>
      </div>

      {/* Preview table */}
      <div className="mb-6 overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
              <th className="px-3 py-2 text-left text-xs font-semibold">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Style Name
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Style #
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Prev #
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Gender
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Colorways
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Sample
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Launch
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {Q2_PRODUCTS.map((p, i) => {
              const snUpper = p.styleNumber.trim().toUpperCase()
              const isDupe = snUpper
                ? existingSet?.has(snUpper) ?? false
                : false
              return (
                <tr
                  key={p.styleNumber || i}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2 font-medium text-[var(--color-text)]">
                    {p.styleName}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--color-text)]">
                    {p.styleNumber || "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--color-text-muted)]">
                    {p.previousStyleNumber || "—"}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">
                    {p.gender || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.colorways.map((cw) => (
                        <Badge
                          key={cw.colorName}
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {cw.colorName}
                          {cw.recolorNote ? " *" : ""}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {p.sampleStatus ? (
                      <span
                        className={`text-xs font-medium ${statusColor[p.sampleStatus] ?? ""}`}
                      >
                        {p.sampleStatus.split("_").join(" ")}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-subtle)]">
                        —
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--color-text-muted)]">
                    {p.launchDate}
                  </td>
                  <td className="px-3 py-2">
                    {isDupe ? (
                      <Badge variant="outline" className="text-xs text-amber-600">
                        Exists
                      </Badge>
                    ) : existingSet ? (
                      <Badge variant="outline" className="text-xs text-green-600">
                        New
                      </Badge>
                    ) : (
                      <span className="text-xs text-[var(--color-text-subtle)]">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          onClick={checkDuplicates}
          disabled={checking || running || !clientId}
          variant="outline"
        >
          {checking ? "Checking..." : "Check Duplicates"}
        </Button>
        <Button
          onClick={runImport}
          disabled={running || done || !clientId || !existingSet}
        >
          {running ? "Importing..." : done ? "Done" : "Run Import"}
        </Button>
        {!existingSet && (
          <span className="text-xs text-[var(--color-text-muted)]">
            Check duplicates first before importing.
          </span>
        )}
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">
            Import Log
          </h3>
          <div className="flex flex-col gap-1 font-mono text-xs">
            {log.map((entry, i) => (
              <div
                key={i}
                className={
                  entry.variant === "error"
                    ? "text-red-600"
                    : entry.variant === "success"
                      ? "text-green-600"
                      : entry.variant === "skip"
                        ? "text-amber-600"
                        : "text-[var(--color-text-muted)]"
                }
              >
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
