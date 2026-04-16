import { useEffect, useState, useCallback, useRef } from "react"
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { useAuth } from "@/app/providers/AuthProvider"
import { exportTemplatesPath, exportTemplateDocPath } from "@/shared/lib/paths"
import { BUILT_IN_TEMPLATES } from "../lib/builtInTemplates"
import type { ExportTemplate, ExportPage, PageSettings } from "../types/exportBuilder"
import { loadTemplates as loadLocalStorageTemplates } from "../lib/documentPersistence"

const LS_TEMPLATES_KEY = "sb:export-templates"
const LS_MIGRATED_PREFIX = "sb:export-templates-migrated:"

export interface UseExportTemplatesReturn {
  readonly templates: readonly ExportTemplate[]
  readonly workspaceTemplates: readonly ExportTemplate[]
  readonly loading: boolean
  readonly saveTemplate: (
    name: string,
    description: string,
    pages: readonly ExportPage[],
    settings: PageSettings,
  ) => Promise<string>
  readonly deleteTemplate: (templateId: string) => Promise<void>
}

function mapTemplate(
  id: string,
  data: Record<string, unknown>,
): ExportTemplate {
  const createdAt = data.createdAt as Timestamp | null | undefined
  const updatedAt = data.updatedAt as Timestamp | null | undefined
  return {
    id,
    name: (data.name as string) ?? "Untitled",
    description: (data.description as string) ?? "",
    category: "workspace",
    pages: (data.pages as ExportPage[]) ?? [],
    settings: (data.settings as PageSettings) ?? {
      layout: "portrait",
      size: "letter",
      fontFamily: "Inter",
    },
    createdBy: (data.createdBy as string) ?? "",
    createdAt: createdAt?.toDate?.().toISOString() ?? undefined,
    updatedAt: updatedAt?.toDate?.().toISOString() ?? undefined,
  }
}

export function useExportTemplates(
  clientId: string | null,
): UseExportTemplatesReturn {
  const { user } = useAuth()
  const [workspaceTemplates, setWorkspaceTemplates] = useState<
    readonly ExportTemplate[]
  >([])
  const [loading, setLoading] = useState(true)
  const migrationAttempted = useRef(false)

  useEffect(() => {
    if (!clientId) {
      setWorkspaceTemplates([])
      setLoading(false)
      return
    }

    const pathSegments = exportTemplatesPath(clientId)
    const collRef = collection(db, pathSegments[0]!, ...pathSegments.slice(1))
    const q = query(collRef, orderBy("updatedAt", "desc"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) =>
          mapTemplate(d.id, d.data() as Record<string, unknown>),
        )
        setWorkspaceTemplates(docs)
        setLoading(false)
      },
      (err) => {
        const fireErr = err as { message?: string }
        console.error("[useExportTemplates]", fireErr.message ?? err)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [clientId])

  // One-time localStorage → Firestore migration
  useEffect(() => {
    if (!clientId || !user?.uid || migrationAttempted.current) return
    migrationAttempted.current = true

    const migratedKey = `${LS_MIGRATED_PREFIX}${clientId}`
    const alreadyMigrated = localStorage.getItem(migratedKey)
    if (alreadyMigrated) return

    const localTemplates = loadLocalStorageTemplates()
    if (localTemplates.length === 0) {
      localStorage.setItem(migratedKey, "true")
      return
    }

    void migrateLocalTemplates(clientId, user.uid, localTemplates, migratedKey)
  }, [clientId, user?.uid])

  const saveTemplate = useCallback(
    async (
      name: string,
      description: string,
      pages: readonly ExportPage[],
      settings: PageSettings,
    ): Promise<string> => {
      if (!clientId) throw new Error("Missing clientId")
      const pathSegments = exportTemplatesPath(clientId)
      const collRef = collection(db, pathSegments[0]!, ...pathSegments.slice(1))
      const newDocRef = doc(collRef)
      await setDoc(newDocRef, {
        name,
        description,
        pages,
        settings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid ?? "",
      })
      return newDocRef.id
    },
    [clientId, user?.uid],
  )

  const deleteTemplate = useCallback(
    async (templateId: string) => {
      if (!clientId) return
      const pathSegments = exportTemplateDocPath(clientId, templateId)
      const docRef = doc(db, pathSegments[0]!, ...pathSegments.slice(1))
      await deleteDoc(docRef)
    },
    [clientId],
  )

  const templates: readonly ExportTemplate[] = [
    ...BUILT_IN_TEMPLATES,
    ...workspaceTemplates,
  ]

  return { templates, workspaceTemplates, loading, saveTemplate, deleteTemplate }
}

async function migrateLocalTemplates(
  clientId: string,
  uid: string,
  localTemplates: readonly ExportTemplate[],
  migratedKey: string,
): Promise<void> {
  try {
    const pathSegments = exportTemplatesPath(clientId)
    const collRef = collection(db, pathSegments[0]!, ...pathSegments.slice(1))
    const existing = await getDocs(collRef)
    const existingNames = new Set(
      existing.docs.map((d) => (d.data() as Record<string, unknown>).name),
    )

    for (const template of localTemplates) {
      if (existingNames.has(template.name)) continue
      const newDocRef = doc(collRef)
      await setDoc(newDocRef, {
        name: template.name,
        description: template.description,
        pages: template.pages,
        settings: template.settings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid,
      })
    }

    localStorage.setItem(migratedKey, "true")
    localStorage.removeItem(LS_TEMPLATES_KEY)
  } catch (err) {
    console.error("[useExportTemplates] migration failed:", err)
  }
}
