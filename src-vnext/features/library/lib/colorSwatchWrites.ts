import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { colorSwatchPath } from "@/shared/lib/paths"
import { normalizeColorName, normalizeHexColor } from "@/features/library/lib/colorSwatches"

interface SaveColorSwatchOptions {
  readonly clientId: string
  readonly swatchId: string
  readonly name: string
  readonly hexColor?: string | null
  readonly aliases?: readonly string[]
  readonly swatchImagePath?: string | null
  readonly isNew?: boolean
}

// Merge write: only touch hex / aliases / swatch image when the caller passes
// them, so an edit keeps what is stored (e.g. a retired duplicate's name).
// A new swatch starts with all three empty.
function optionalSwatchFields(opts: SaveColorSwatchOptions): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  if (opts.hexColor !== undefined) fields.hexColor = normalizeHexColor(opts.hexColor) ?? null
  else if (opts.isNew) fields.hexColor = null
  if (opts.aliases !== undefined) fields.aliases = opts.aliases.filter(Boolean)
  else if (opts.isNew) fields.aliases = []
  if (opts.swatchImagePath !== undefined) fields.swatchImagePath = opts.swatchImagePath
  else if (opts.isNew) fields.swatchImagePath = null
  return fields
}

export async function saveColorSwatch(opts: SaveColorSwatchOptions) {
  const name = opts.name.trim()
  if (!name) throw new Error("Name is required")

  const swatchId = opts.swatchId.trim()
  if (!swatchId) throw new Error("Swatch id is required")

  const normalizedName = normalizeColorName(name)

  const path = colorSwatchPath(swatchId, opts.clientId)
  const ref = doc(db, path[0]!, ...path.slice(1))

  const payload: Record<string, unknown> = {
    name,
    colorKey: swatchId,
    normalizedName,
    ...optionalSwatchFields(opts),
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

