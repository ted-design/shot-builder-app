import { useEffect, useState, useCallback } from "react"
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { useAuth } from "@/app/providers/AuthProvider"
import { exportReportsPath, exportReportDocPath } from "@/shared/lib/paths"
import type {
  ExportPage,
  PageItem,
  PageSettings,
  CustomVariable,
} from "../types/exportBuilder"

export interface ExportReport {
  readonly id: string
  readonly name: string
  readonly schemaVersion: number
  readonly updatedAt: Date | null
  readonly createdBy: string
}

/** Full report data including pages/settings, returned by loadReport */
export interface ExportReportFull extends ExportReport {
  readonly pages: readonly ExportPage[]
  readonly settings: PageSettings
  readonly customVariables: readonly CustomVariable[]
}

interface SaveReportData {
  readonly name: string
  readonly pages: readonly ExportPage[]
  readonly settings: PageSettings
  readonly customVariables?: readonly CustomVariable[]
}

export interface UseExportReportsReturn {
  readonly reports: readonly ExportReport[]
  readonly loading: boolean
  readonly saveReport: (reportId: string, data: SaveReportData) => Promise<void>
  readonly deleteReport: (reportId: string) => Promise<void>
  readonly createReport: (name: string) => Promise<string>
  readonly loadReport: (reportId: string) => Promise<ExportReportFull | null>
  readonly importReport: (
    name: string,
    pages: readonly ExportPage[],
    settings: PageSettings,
    customVariables?: readonly CustomVariable[],
  ) => Promise<string>
}

function mapReport(
  id: string,
  data: Record<string, unknown>,
): ExportReport {
  const ts = data.updatedAt as Timestamp | null | undefined
  return {
    id,
    name: (data.name as string) ?? "Untitled",
    schemaVersion: (data.schemaVersion as number) ?? 1,
    updatedAt: ts?.toDate?.() ?? null,
    createdBy: (data.createdBy as string) ?? "",
  }
}

export function useExportReports(
  clientId: string | null,
  projectId: string | undefined,
): UseExportReportsReturn {
  const { user } = useAuth()
  const [reports, setReports] = useState<readonly ExportReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId || !projectId) {
      setReports([])
      setLoading(false)
      return
    }

    const pathSegments = exportReportsPath(clientId, projectId)
    const collRef = collection(db, pathSegments[0]!, ...pathSegments.slice(1))
    const q = query(collRef, orderBy("updatedAt", "desc"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) =>
          mapReport(d.id, d.data() as Record<string, unknown>),
        )
        setReports(docs)
        setLoading(false)
      },
      (err) => {
        const fireErr = err as { message?: string }
        console.error("[useExportReports]", fireErr.message ?? err)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [clientId, projectId])

  const saveReport = useCallback(
    async (reportId: string, data: SaveReportData) => {
      if (!clientId || !projectId) return
      const pathSegments = exportReportDocPath(clientId, projectId, reportId)
      const docRef = doc(db, pathSegments[0]!, ...pathSegments.slice(1))
      await setDoc(
        docRef,
        {
          name: data.name,
          pages: data.pages,
          schemaVersion: 2,
          settings: data.settings,
          customVariables: data.customVariables ?? [],
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid ?? "",
        },
        { merge: true },
      )
    },
    [clientId, projectId, user?.uid],
  )

  const createReport = useCallback(
    async (name: string): Promise<string> => {
      if (!clientId || !projectId) throw new Error("Missing clientId or projectId")
      const pathSegments = exportReportsPath(clientId, projectId)
      const collRef = collection(db, pathSegments[0]!, ...pathSegments.slice(1))
      const newDocRef = doc(collRef)
      await setDoc(newDocRef, {
        name,
        schemaVersion: 2,
        pages: [{ id: crypto.randomUUID(), items: [] }],
        settings: {
          layout: "portrait",
          size: "letter",
          fontFamily: "Inter",
        },
        customVariables: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid ?? "",
        updatedBy: user?.uid ?? "",
      })
      return newDocRef.id
    },
    [clientId, projectId, user?.uid],
  )

  const loadReport = useCallback(
    async (reportId: string): Promise<ExportReportFull | null> => {
      if (!clientId || !projectId) return null
      const pathSegments = exportReportDocPath(clientId, projectId, reportId)
      const docRef = doc(db, pathSegments[0]!, ...pathSegments.slice(1))
      const snap = await getDoc(docRef)
      if (!snap.exists()) return null
      const data = snap.data() as Record<string, unknown>
      const summary = mapReport(snap.id, data)

      // v2: pages array
      let pages: readonly ExportPage[]
      if (Array.isArray(data.pages)) {
        pages = data.pages as ExportPage[]
      }
      // v1 fallback: flat items array
      else if (Array.isArray(data.items)) {
        pages = [{ id: "page-1", items: data.items as PageItem[] }]
      } else {
        pages = [{ id: "page-1", items: [] }]
      }

      return {
        ...summary,
        pages,
        settings: (data.settings as PageSettings) ?? {
          layout: "portrait",
          size: "letter",
          fontFamily: "Inter",
        },
        customVariables: (data.customVariables as readonly CustomVariable[]) ?? [],
      }
    },
    [clientId, projectId],
  )

  const importReport = useCallback(
    async (
      name: string,
      pages: readonly ExportPage[],
      settings: PageSettings,
      customVariables?: readonly CustomVariable[],
    ): Promise<string> => {
      if (!clientId || !projectId) throw new Error("Missing clientId or projectId")
      const pathSegments = exportReportsPath(clientId, projectId)
      const collRef = collection(db, pathSegments[0]!, ...pathSegments.slice(1))
      const newDocRef = doc(collRef)
      await setDoc(newDocRef, {
        name,
        schemaVersion: 2,
        pages,
        settings,
        customVariables: customVariables ?? [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid ?? "",
        updatedBy: user?.uid ?? "",
      })
      return newDocRef.id
    },
    [clientId, projectId, user?.uid],
  )

  const deleteReport = useCallback(
    async (reportId: string) => {
      if (!clientId || !projectId) return
      const pathSegments = exportReportDocPath(clientId, projectId, reportId)
      const docRef = doc(db, pathSegments[0]!, ...pathSegments.slice(1))
      await deleteDoc(docRef)
    },
    [clientId, projectId],
  )

  return { reports, loading, saveReport, deleteReport, createReport, loadReport, importReport }
}
