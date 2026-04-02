import { createContext, useContext } from "react"
import type { ReactNode } from "react"
import { useExportData } from "../hooks/useExportData"
import type { ExportData } from "../hooks/useExportData"

const ExportDataContext = createContext<ExportData | null>(null)

export function ExportDataProvider({ children }: { readonly children: ReactNode }) {
  const data = useExportData()
  return (
    <ExportDataContext.Provider value={data}>
      {children}
    </ExportDataContext.Provider>
  )
}

export function useExportDataContext(): ExportData {
  const ctx = useContext(ExportDataContext)
  if (!ctx) {
    throw new Error(
      "useExportDataContext must be used within an ExportDataProvider",
    )
  }
  return ctx
}
