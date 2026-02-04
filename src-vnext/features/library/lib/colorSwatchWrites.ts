import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { colorSwatchPath } from "@/shared/lib/paths"
import { normalizeColorName, normalizeHexColor } from "@/features/library/lib/colorSwatches"

export async function saveColorSwatch(opts: {
  readonly clientId: string
  readonly swatchId: string
  readonly name: string
  readonly hexColor?: string | null
  readonly aliases?: readonly string[]
  readonly swatchImagePath?: string | null
  readonly isNew?: boolean
}) {
  const name = opts.name.trim()
  if (!name) throw new Error("Name is required")

  const swatchId = opts.swatchId.trim()
  if (!swatchId) throw new Error("Swatch id is required")

  const normalizedName = normalizeColorName(name)
  const hexColor = normalizeHexColor(opts.hexColor) ?? null

  const path = colorSwatchPath(swatchId, opts.clientId)
  const ref = doc(db, path[0]!, ...path.slice(1))

  const payload: Record<string, unknown> = {
    name,
    colorKey: swatchId,
    normalizedName,
    hexColor,
    aliases: Array.isArray(opts.aliases) ? opts.aliases.filter(Boolean) : [],
    swatchImagePath: opts.swatchImagePath ?? null,
    updatedAt: serverTimestamp(),
  }

  if (opts.isNew) {
    payload.createdAt = serverTimestamp()
  }

  await setDoc(ref, payload, { merge: true })
  return { id: ref.id, ...payload }
}

export async function deleteColorSwatch(opts: {
  readonly clientId: string
  readonly swatchId: string
}) {
  const swatchId = opts.swatchId.trim()
  if (!swatchId) throw new Error("Swatch id is required")

  const path = colorSwatchPath(swatchId, opts.clientId)
  await deleteDoc(doc(db, path[0]!, ...path.slice(1)))
}

