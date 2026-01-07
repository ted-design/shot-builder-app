import { useCallback, useEffect, useMemo, useState } from "react";
import { useCallSheetConfig } from "../../hooks/useCallSheetConfig";
import type { CallSheetColors } from "./types";

const DEFAULT_COLORS: CallSheetColors = {
  primary: "#1a365d",
  primaryText: "#ffffff",
  accent: "#fc5b54",
  rowAlternate: "#e8f4f8",
};

function coerceHexColor(value: unknown, fallback: string) {
  const str = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(str) ? str : fallback;
}

export function useCallSheetPreviewColors(
  clientId: string | null,
  projectId: string | null,
  scheduleId: string | null
) {
  const { config, updateConfig } = useCallSheetConfig(clientId, projectId, scheduleId);

  const colorsFromConfig = useMemo<CallSheetColors>(() => {
    const raw = config?.colors as any;
    if (!raw) return DEFAULT_COLORS;
    return {
      primary: coerceHexColor(raw.primary, DEFAULT_COLORS.primary),
      primaryText: coerceHexColor(raw.primaryText, DEFAULT_COLORS.primaryText),
      accent: coerceHexColor(raw.accent, DEFAULT_COLORS.accent),
      rowAlternate: coerceHexColor(raw.rowAlternate, DEFAULT_COLORS.rowAlternate),
    };
  }, [config?.colors]);

  const [colors, setColors] = useState<CallSheetColors>(colorsFromConfig);

  useEffect(() => {
    setColors(colorsFromConfig);
  }, [colorsFromConfig]);

  const persistColors = useCallback(
    (nextColors: CallSheetColors) => {
      setColors(nextColors);
      if (!config) return;
      updateConfig.mutate({
        colors: {
          ...(config.colors as any),
          primary: nextColors.primary,
          primaryText: nextColors.primaryText,
          accent: nextColors.accent,
          rowAlternate: nextColors.rowAlternate,
        },
      } as any);
    },
    [config, updateConfig]
  );

  return {
    colors,
    setColors,
    persistColors,
    isSaving: updateConfig.isPending,
  };
}

