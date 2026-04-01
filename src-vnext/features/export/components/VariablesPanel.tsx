import { useCallback } from "react"
import { toast } from "sonner"
import type { ExportVariable } from "../types/exportBuilder"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/ui/sheet"

interface VariablesPanelProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly variables: readonly ExportVariable[]
}

function VariableChip({
  variable,
}: {
  readonly variable: ExportVariable
}) {
  const handleClick = useCallback(() => {
    const token = `{{${variable.key}}}`
    navigator.clipboard.writeText(token).then(() => {
      toast.success(`Copied ${token}`)
    }).catch(() => {
      toast.error("Failed to copy token")
    })
  }, [variable.key])

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-left transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:hover:bg-indigo-900"
    >
      <span className="text-2xs font-medium text-indigo-700 dark:text-indigo-300">
        {variable.label}
      </span>
      <span className="text-2xs text-indigo-500 dark:text-indigo-400">
        {variable.value || "—"}
      </span>
    </button>
  )
}

export function VariablesPanel({
  open,
  onOpenChange,
  variables,
}: VariablesPanelProps) {
  const dynamicVars = variables.filter((v) => v.source === "dynamic")
  const customVars = variables.filter((v) => v.source === "custom")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Variables</SheetTitle>
          <SheetDescription>
            Click a variable to copy its token.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-6">
          {/* Dynamic section */}
          <section>
            <h3 className="text-2xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Dynamic
            </h3>
            <div className="mt-2 flex flex-col gap-1.5">
              {dynamicVars.map((variable) => (
                <VariableChip key={variable.key} variable={variable} />
              ))}
              {dynamicVars.length === 0 && (
                <p className="text-2xs text-[var(--color-text-muted)]">
                  No dynamic variables available.
                </p>
              )}
            </div>
          </section>

          {/* Custom section */}
          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-2xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                Custom
              </h3>
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {customVars.length === 0 ? (
                <p className="text-2xs text-[var(--color-text-muted)]">
                  No custom variables yet.
                </p>
              ) : (
                customVars.map((variable) => (
                  <VariableChip key={variable.key} variable={variable} />
                ))
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
