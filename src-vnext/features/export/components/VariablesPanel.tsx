import { useCallback } from "react"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
import type { ExportVariable, CustomVariable } from "../types/exportBuilder"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/ui/sheet"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"

interface VariablesPanelProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly variables: readonly ExportVariable[]
  readonly customVariables: readonly CustomVariable[]
  readonly onAddCustomVariable: () => void
  readonly onUpdateCustomVariable: (
    key: string,
    updates: Partial<CustomVariable>,
  ) => void
  readonly onDeleteCustomVariable: (key: string) => void
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

function CustomVariableRow({
  variable,
  onUpdate,
  onDelete,
  onCopy,
}: {
  readonly variable: CustomVariable
  readonly onUpdate: (key: string, updates: Partial<CustomVariable>) => void
  readonly onDelete: (key: string) => void
  readonly onCopy: (key: string) => void
}) {
  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(variable.key, { label: e.target.value })
    },
    [variable.key, onUpdate],
  )

  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(variable.key, { value: e.target.value })
    },
    [variable.key, onUpdate],
  )

  const handleDelete = useCallback(() => {
    onDelete(variable.key)
  }, [variable.key, onDelete])

  const handleCopy = useCallback(() => {
    onCopy(variable.key)
  }, [variable.key, onCopy])

  return (
    <div className="group flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1.5">
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 text-2xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        title="Copy token"
      >
        {"{{}}"}
      </button>
      <Input
        value={variable.label}
        onChange={handleLabelChange}
        placeholder="Label"
        className="h-6 flex-1 border-none bg-transparent px-1 text-2xs shadow-none focus-visible:ring-0"
      />
      <Input
        value={variable.value}
        onChange={handleValueChange}
        placeholder="Value"
        className="h-6 flex-1 border-none bg-transparent px-1 text-2xs shadow-none focus-visible:ring-0"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDelete}
        className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}

export function VariablesPanel({
  open,
  onOpenChange,
  variables,
  customVariables,
  onAddCustomVariable,
  onUpdateCustomVariable,
  onDeleteCustomVariable,
}: VariablesPanelProps) {
  const dynamicVars = variables.filter((v) => v.source === "dynamic")

  const handleCopyToken = useCallback((key: string) => {
    const token = `{{${key}}}`
    navigator.clipboard.writeText(token).then(() => {
      toast.success(`Copied ${token}`)
    }).catch(() => {
      toast.error("Failed to copy token")
    })
  }, [])

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
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddCustomVariable}
                className="h-6 gap-1 px-2 text-2xs"
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {customVariables.length === 0 ? (
                <p className="text-2xs text-[var(--color-text-muted)]">
                  No custom variables yet.
                </p>
              ) : (
                customVariables.map((variable) => (
                  <CustomVariableRow
                    key={variable.key}
                    variable={variable}
                    onUpdate={onUpdateCustomVariable}
                    onDelete={onDeleteCustomVariable}
                    onCopy={handleCopyToken}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
