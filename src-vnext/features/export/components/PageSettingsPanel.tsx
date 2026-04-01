import { useCallback } from "react"
import type { PageSettings } from "../types/exportBuilder"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Slider } from "@/ui/slider"

interface PageSettingsPanelProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly settings: PageSettings
  readonly onUpdateSettings: (settings: PageSettings) => void
}

export function PageSettingsPanel({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
}: PageSettingsPanelProps) {
  const handleLayoutChange = useCallback(
    (value: string) => {
      onUpdateSettings({
        ...settings,
        layout: value as "portrait" | "landscape",
      })
    },
    [settings, onUpdateSettings],
  )

  const handleSizeChange = useCallback(
    (value: string) => {
      onUpdateSettings({
        ...settings,
        size: value as "letter" | "a4" | "legal",
      })
    },
    [settings, onUpdateSettings],
  )

  const handleFontChange = useCallback(
    (value: string) => {
      onUpdateSettings({ ...settings, fontFamily: value })
    },
    [settings, onUpdateSettings],
  )

  const handleWatermarkTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value
      if (!text) {
        const { watermark: _removed, ...rest } = settings
        onUpdateSettings(rest as PageSettings)
        return
      }
      onUpdateSettings({
        ...settings,
        watermark: {
          text,
          opacity: settings.watermark?.opacity ?? 15,
          fontSize: settings.watermark?.fontSize ?? 48,
          color: settings.watermark?.color ?? "#000000",
        },
      })
    },
    [settings, onUpdateSettings],
  )

  const handleWatermarkOpacityChange = useCallback(
    (value: number[]) => {
      if (!settings.watermark) return
      onUpdateSettings({
        ...settings,
        watermark: { ...settings.watermark, opacity: value[0] ?? 15 },
      })
    },
    [settings, onUpdateSettings],
  )

  const handleWatermarkFontSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!settings.watermark) return
      const fontSize = Number(e.target.value) || 48
      onUpdateSettings({
        ...settings,
        watermark: { ...settings.watermark, fontSize },
      })
    },
    [settings, onUpdateSettings],
  )

  const handleWatermarkColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!settings.watermark) return
      onUpdateSettings({
        ...settings,
        watermark: { ...settings.watermark, color: e.target.value },
      })
    },
    [settings, onUpdateSettings],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Page Settings</SheetTitle>
          <SheetDescription>
            Configure document layout, sizing, and watermark.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-5">
          {/* Layout */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-layout">Layout</Label>
            <Select value={settings.layout} onValueChange={handleLayoutChange}>
              <SelectTrigger id="page-layout">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Page size */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-size">Page Size</Label>
            <Select value={settings.size} onValueChange={handleSizeChange}>
              <SelectTrigger id="page-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="letter">Letter</SelectItem>
                <SelectItem value="a4">A4</SelectItem>
                <SelectItem value="legal">Legal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Default font */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-font">Default Font</Label>
            <Select value={settings.fontFamily} onValueChange={handleFontChange}>
              <SelectTrigger id="page-font">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Inter">Inter</SelectItem>
                <SelectItem value="Helvetica">Helvetica</SelectItem>
                <SelectItem value="Georgia">Georgia</SelectItem>
                <SelectItem value="Courier New">Courier New</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Watermark */}
          <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] p-3">
            <h3 className="text-sm font-medium text-[var(--color-text)]">
              Watermark
            </h3>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="watermark-text">Text</Label>
              <Input
                id="watermark-text"
                placeholder="e.g. DRAFT, CONFIDENTIAL"
                value={settings.watermark?.text ?? ""}
                onChange={handleWatermarkTextChange}
              />
            </div>

            {settings.watermark && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Opacity ({settings.watermark.opacity}%)
                  </Label>
                  <Slider
                    value={[settings.watermark.opacity]}
                    onValueChange={handleWatermarkOpacityChange}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="watermark-font-size">Font Size (px)</Label>
                  <Input
                    id="watermark-font-size"
                    type="number"
                    min={8}
                    max={200}
                    value={settings.watermark.fontSize}
                    onChange={handleWatermarkFontSizeChange}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="watermark-color">Color</Label>
                  <Input
                    id="watermark-color"
                    type="color"
                    value={settings.watermark.color}
                    onChange={handleWatermarkColorChange}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
