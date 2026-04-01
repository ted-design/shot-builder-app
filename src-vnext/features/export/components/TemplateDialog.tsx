import { useState, useCallback } from "react"
import type { ExportTemplate } from "../types/exportBuilder"
import { BUILT_IN_TEMPLATES } from "../lib/builtInTemplates"
import { loadTemplates } from "../lib/documentPersistence"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/tabs"
import { Button } from "@/ui/button"

interface TemplateDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSelectTemplate: (template: ExportTemplate) => void
  readonly onSaveCurrent?: () => void
}

function TemplatePreview({
  template,
}: {
  readonly template: ExportTemplate
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-2xs font-medium text-[var(--color-text)]">
        Preview
      </p>
      <div className="flex flex-col gap-1.5">
        {template.pages.flatMap((page) =>
          page.blocks.map((block) => {
            const height =
              block.type === "text" ? "h-3" :
              block.type === "shot-grid" || block.type === "product-table" ? "h-10" :
              block.type === "shot-detail" ? "h-8" :
              block.type === "divider" ? "h-px" :
              block.type === "page-break" ? "h-px" :
              "h-6"

            const width =
              block.type === "text" ? "w-3/4" :
              block.type === "divider" ? "w-full" :
              "w-full"

            return (
              <div
                key={block.id}
                className={`${height} ${width} rounded-sm bg-[var(--color-border)]`}
              />
            )
          }),
        )}
      </div>
      <p className="text-2xs text-[var(--color-text-muted)]">
        {template.settings.layout === "landscape" ? "Landscape" : "Portrait"} | {template.settings.size.toUpperCase()}
      </p>
    </div>
  )
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  readonly template: ExportTemplate
  readonly selected: boolean
  readonly onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col gap-1 rounded-md border p-3 text-left transition-colors ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
          : "border-[var(--color-border)] hover:border-[var(--color-text-muted)]"
      }`}
    >
      <span className="text-sm font-medium text-[var(--color-text)]">
        {template.name}
      </span>
      <span className="text-2xs text-[var(--color-text-muted)]">
        {template.description}
      </span>
    </button>
  )
}

export function TemplateDialog({
  open,
  onOpenChange,
  onSelectTemplate,
  onSaveCurrent,
}: TemplateDialogProps) {
  const [selected, setSelected] = useState<ExportTemplate | null>(null)
  const savedTemplates = open ? loadTemplates() : []

  const handleConfirm = useCallback(() => {
    if (!selected) return
    onSelectTemplate(selected)
    onOpenChange(false)
    setSelected(null)
  }, [selected, onSelectTemplate, onOpenChange])

  const handleCancel = useCallback(() => {
    onOpenChange(false)
    setSelected(null)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
          <DialogDescription>
            Start with a pre-built layout or one of your saved templates.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4">
          <div className="flex-1">
            <Tabs defaultValue="built-in">
              <TabsList>
                <TabsTrigger value="built-in">Built-in</TabsTrigger>
                <TabsTrigger value="saved">Saved</TabsTrigger>
              </TabsList>

              <TabsContent value="built-in">
                <div className="flex flex-col gap-2 pt-2">
                  {BUILT_IN_TEMPLATES.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      selected={selected?.id === template.id}
                      onSelect={() => setSelected(template)}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="saved">
                <div className="flex flex-col gap-2 pt-2">
                  {onSaveCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onSaveCurrent}
                      className="self-start"
                    >
                      Save current as template
                    </Button>
                  )}
                  {savedTemplates.length === 0 ? (
                    <p className="py-6 text-center text-2xs text-[var(--color-text-muted)]">
                      No saved templates yet.
                    </p>
                  ) : (
                    savedTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        selected={selected?.id === template.id}
                        onSelect={() => setSelected(template)}
                      />
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {selected && (
            <div className="w-[200px] shrink-0">
              <TemplatePreview template={selected} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selected}>
            Use Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
