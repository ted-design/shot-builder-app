import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { productClassificationsPath } from "@/shared/lib/paths"
import {
  buildProductClassificationId,
  normalizeClassificationGender,
  normalizeClassificationKey,
  slugifyClassificationKey,
} from "@/features/products/lib/productClassifications"

interface SaveProductClassificationArgs {
  readonly clientId: string
  readonly userId: string | null
  readonly gender: string
  readonly typeKey: string
  readonly typeLabel: string
  readonly subcategoryKey?: string | null
  readonly subcategoryLabel?: string | null
  readonly archived?: boolean
  readonly isNew?: boolean
}

function classificationDocRef(args: {
  readonly clientId: string
  readonly id: string
}) {
  const base = productClassificationsPath(args.clientId)
  return doc(db, base[0]!, ...base.slice(1), args.id)
}

export async function saveProductClassification(args: SaveProductClassificationArgs): Promise<string> {
  const gender = normalizeClassificationGender(args.gender)
  const typeKey = normalizeClassificationKey(args.typeKey)
  const subcategoryKey = normalizeClassificationKey(args.subcategoryKey ?? null)
  const typeLabel = args.typeLabel.trim()
  const subcategoryLabel = typeof args.subcategoryLabel === "string" ? args.subcategoryLabel.trim() : ""

  if (!gender) throw new Error("Gender is required.")
  if (!typeKey) throw new Error("Type key is required.")
  if (!typeLabel) throw new Error("Type label is required.")
  if (subcategoryKey && !subcategoryLabel) throw new Error("Subcategory label is required.")

  const id = buildProductClassificationId({ gender, typeKey, subcategoryKey })
  const ref = classificationDocRef({ clientId: args.clientId, id })

  const payload: Record<string, unknown> = {
    gender,
    typeKey,
    typeLabel,
    subcategoryKey: subcategoryKey ?? null,
    subcategoryLabel: subcategoryKey ? subcategoryLabel : null,
    archived: args.archived === true,
    updatedAt: serverTimestamp(),
    updatedBy: args.userId,
  }

  if (args.isNew) {
    payload.createdAt = serverTimestamp()
    payload.createdBy = args.userId
  }

  await setDoc(ref, payload, { merge: true })
  return id
}

export async function createTypeClassification(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly gender: string
  readonly typeLabel: string
}): Promise<string> {
  const typeLabel = args.typeLabel.trim()
  const typeKey = slugifyClassificationKey(typeLabel)
  if (!typeKey) throw new Error("Type label is required.")
  return saveProductClassification({
    clientId: args.clientId,
    userId: args.userId,
    gender: args.gender,
    typeKey,
    typeLabel,
    subcategoryKey: null,
    subcategoryLabel: null,
    archived: false,
    isNew: true,
  })
}

export async function createSubcategoryClassification(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly gender: string
  readonly typeKey: string
  readonly typeLabel: string
  readonly subcategoryLabel: string
}): Promise<string> {
  const subcategoryLabel = args.subcategoryLabel.trim()
  const subcategoryKey = slugifyClassificationKey(subcategoryLabel)
  if (!subcategoryKey) throw new Error("Subcategory label is required.")
  return saveProductClassification({
    clientId: args.clientId,
    userId: args.userId,
    gender: args.gender,
    typeKey: args.typeKey,
    typeLabel: args.typeLabel,
    subcategoryKey,
    subcategoryLabel,
    archived: false,
    isNew: true,
  })
}

export async function renameProductClassification(args: {
  readonly clientId: string
  readonly id: string
  readonly userId: string | null
  readonly typeLabel?: string
  readonly subcategoryLabel?: string | null
}): Promise<void> {
  const ref = classificationDocRef({ clientId: args.clientId, id: args.id })
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: args.userId,
  }
  if (typeof args.typeLabel === "string") {
    const typeLabel = args.typeLabel.trim()
    if (!typeLabel) throw new Error("Type label is required.")
    payload.typeLabel = typeLabel
  }
  if (args.subcategoryLabel !== undefined) {
    payload.subcategoryLabel =
      args.subcategoryLabel && args.subcategoryLabel.trim().length > 0
        ? args.subcategoryLabel.trim()
        : null
  }
  await updateDoc(ref, payload)
}

export async function setProductClassificationArchived(args: {
  readonly clientId: string
  readonly id: string
  readonly userId: string | null
  readonly archived: boolean
}): Promise<void> {
  const ref = classificationDocRef({ clientId: args.clientId, id: args.id })
  await updateDoc(ref, {
    archived: args.archived === true,
    updatedAt: serverTimestamp(),
    updatedBy: args.userId,
  })
}

export async function deleteProductClassification(args: {
  readonly clientId: string
  readonly id: string
}): Promise<void> {
  const ref = classificationDocRef({ clientId: args.clientId, id: args.id })
  await deleteDoc(ref)
}
