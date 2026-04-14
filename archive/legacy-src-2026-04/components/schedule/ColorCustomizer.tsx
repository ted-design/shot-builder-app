import React from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { CallSheetColors } from "./types";

interface ColorCustomizerProps {
  colors: CallSheetColors;
  onChange: (colors: CallSheetColors) => void;
}

const PRESET_THEMES: Array<{ name: string; primary: string; accent: string }> = [
  { name: "Classic Navy", primary: "#1a365d", accent: "#fc5b54" },
  { name: "Forest Green", primary: "#22543d", accent: "#ed8936" },
  { name: "Slate", primary: "#2d3748", accent: "#4299e1" },
  { name: "Burgundy", primary: "#742a2a", accent: "#f6ad55" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">{children}</div>;
}

export function ColorCustomizer({ colors, onChange }: ColorCustomizerProps) {
  const updateColor = (key: keyof CallSheetColors, value: string) => {
    onChange({ ...colors, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>Primary Color</FieldLabel>
          <div className="flex gap-2 items-center mt-1">
            <input
              type="color"
              value={colors.primary}
              onChange={(e) => updateColor("primary", e.target.value)}
              className="w-10 h-10 rounded cursor-pointer"
              aria-label="Primary color"
            />
            <Input
              value={colors.primary}
              onChange={(e) => updateColor("primary", e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Primary Text Color</FieldLabel>
          <div className="flex gap-2 items-center mt-1">
            <input
              type="color"
              value={colors.primaryText}
              onChange={(e) => updateColor("primaryText", e.target.value)}
              className="w-10 h-10 rounded cursor-pointer"
              aria-label="Primary text color"
            />
            <Input
              value={colors.primaryText}
              onChange={(e) => updateColor("primaryText", e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Accent Color</FieldLabel>
          <div className="flex gap-2 items-center mt-1">
            <input
              type="color"
              value={colors.accent}
              onChange={(e) => updateColor("accent", e.target.value)}
              className="w-10 h-10 rounded cursor-pointer"
              aria-label="Accent color"
            />
            <Input
              value={colors.accent}
              onChange={(e) => updateColor("accent", e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Alternate Row Color</FieldLabel>
          <div className="flex gap-2 items-center mt-1">
            <input
              type="color"
              value={colors.rowAlternate}
              onChange={(e) => updateColor("rowAlternate", e.target.value)}
              className="w-10 h-10 rounded cursor-pointer"
              aria-label="Alternate row color"
            />
            <Input
              value={colors.rowAlternate}
              onChange={(e) => updateColor("rowAlternate", e.target.value)}
              className="font-mono"
            />
          </div>
        </div>
      </div>

      <div>
        <FieldLabel>Presets</FieldLabel>
        <div className="flex flex-wrap gap-2 mt-2">
          {PRESET_THEMES.map((theme) => (
            <Button
              key={theme.name}
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...colors,
                  primary: theme.primary,
                  accent: theme.accent,
                })
              }
              className="flex items-center gap-2"
            >
              <div className="w-4 h-4 rounded" style={{ backgroundColor: theme.primary }} />
              {theme.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

