import {
  CALL_SHEET_LAYOUT_V2_SCHEMA_VERSION,
  type CallSheetColors,
  type CallSheetConfig,
  type CallSheetFieldConfig,
  type CallSheetHeaderConfigV2,
  type CallSheetHeaderItem,
  type CallSheetLayoutV2,
  type CallSheetSectionV2,
  type CallSheetSettingsV2,
} from "../../types/callsheet";
import { DEFAULT_COLUMNS, type ColumnConfig, type ColumnWidth } from "../../types/schedule";

const SECTION_TYPES = new Set([
  "header",
  "day-details",
  "reminders",
  "schedule",
  "clients",
  "talent",
  "extras",
  "advanced-schedule",
  "page-break",
  "crew",
  "notes-contacts",
  "custom-banner",
  "quote",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function coerceNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function coerceString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function coerceCallSheetColors(value: unknown): CallSheetColors {
  const fallback: CallSheetColors = {
    primary: "#0F172A",
    accent: "#2563EB",
    text: "#0F172A",
    background: "#FFFFFF",
    primaryText: "#FFFFFF",
    rowAlternate: "#F8FAFC",
  };
  if (!isRecord(value)) return fallback;
  return {
    primary: coerceString(value.primary, fallback.primary),
    accent: coerceString(value.accent, fallback.accent),
    text: coerceString(value.text, fallback.text),
    background: coerceString(value.background, fallback.background || "#FFFFFF"),
    primaryText: coerceString(value.primaryText, fallback.primaryText || "#FFFFFF"),
    rowAlternate: coerceString(value.rowAlternate, fallback.rowAlternate || "#F8FAFC"),
  };
}

function mapColumnWidthToFieldWidth(width: ColumnWidth) {
  const mapping = {
    xs: "x-small",
    sm: "small",
    md: "medium",
    lg: "large",
    xl: "x-large",
    hidden: "hidden",
  } as const;
  return mapping[width] ?? "medium";
}

function buildScheduleFields(columnConfig: unknown): CallSheetFieldConfig[] {
  const columns: ColumnConfig[] = Array.isArray(columnConfig) && columnConfig.length > 0 ? columnConfig : DEFAULT_COLUMNS;
  const sorted = [...columns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sorted
    .filter((col) => Boolean(col) && typeof col.key === "string" && col.key.length > 0)
    .map((col, idx) => {
      const label = typeof col.label === "string" && col.label.trim() ? col.label.trim() : col.key;
      const width = typeof col.width === "string" ? col.width : "md";
      const visible = col.visible !== false;
      const order = typeof col.order === "number" ? col.order : idx;
      return {
        id: col.key,
        name: label,
        originalName: label,
        width: mapColumnWidthToFieldWidth(width),
        enabled: visible,
        order,
      };
    });
}

function buildHeaderFromLegacy(callSheetConfig: unknown): CallSheetHeaderConfigV2 {
  const v1 = isRecord(callSheetConfig) ? (callSheetConfig as Partial<CallSheetConfig>) : null;
  const preset =
    v1?.headerLayout === "center-logo" || v1?.headerLayout === "multiple-logos" || v1?.headerLayout === "classic"
      ? v1.headerLayout
      : "classic";

  const headerElements = Array.isArray(v1?.headerElements) ? v1.headerElements : [];

  if (headerElements.length > 0) {
    const leftItems: CallSheetHeaderItem[] = [];
    const centerItems: CallSheetHeaderItem[] = [];
    const rightItems: CallSheetHeaderItem[] = [];

    headerElements.forEach((el) => {
      if (!isRecord(el) || typeof el.type !== "string") return;
      const align = el.align === "left" || el.align === "right" || el.align === "center" ? el.align : "center";
      const bucket = align === "left" ? leftItems : align === "right" ? rightItems : centerItems;

      if (el.type === "text") {
        const value = typeof el.value === "string" ? el.value : "";
        const size = el.size === "sm" || el.size === "md" || el.size === "lg" ? el.size : "md";
        const fontSize = size === "sm" ? 12 : size === "lg" ? 20 : 16;
        bucket.push({
          type: "text",
          value,
          enabled: true,
          style: { align, fontSize },
        });
      }

      if (el.type === "image") {
        const src = typeof el.src === "string" ? el.src : "";
        bucket.push({
          type: "image",
          value: src,
          enabled: Boolean(src),
          style: { align },
        });
      }
    });

    return {
      preset,
      centerShape: preset === "center-logo" ? "circle" : "none",
      left: { items: leftItems },
      center: { items: centerItems },
      right: { items: rightItems },
    };
  }

  const left: CallSheetHeaderItem[] = [
    { type: "variable", value: "@companyName", enabled: true, style: { align: "left", fontSize: 12 } },
  ];
  const center: CallSheetHeaderItem[] = [
    { type: "variable", value: "@projectTitle", enabled: true, style: { align: "center", fontSize: 20 } },
  ];
  const right: CallSheetHeaderItem[] = [
    { type: "variable", value: "@currentDate", enabled: true, style: { align: "right", fontSize: 12 } },
    { type: "variable", value: "@dayXofY", enabled: true, style: { align: "right", fontSize: 12 } },
  ];

  return {
    preset,
    centerShape: preset === "center-logo" ? "circle" : "none",
    left: { items: left },
    center: { items: center },
    right: { items: right },
  };
}

function buildSettingsFromLegacy(callSheetConfig: unknown): CallSheetSettingsV2 {
  const v1 = isRecord(callSheetConfig) ? (callSheetConfig as Partial<CallSheetConfig>) : null;

  const pageSizeKey = v1?.pageSize === "letter" || v1?.pageSize === "a4" || v1?.pageSize === "auto" ? v1.pageSize : "auto";
  const pageSize =
    pageSizeKey === "a4"
      ? { width: 210, height: 297, unit: "mm" as const }
      : { width: 8.5, height: 11, unit: "inches" as const };

  const spacing = v1?.spacing === "compact" || v1?.spacing === "relaxed" || v1?.spacing === "normal" ? v1.spacing : "normal";
  const timeFormat = v1?.timeFormat === "24h" || v1?.timeFormat === "12h" ? v1.timeFormat : "12h";
  const tempFormat =
    v1?.temperatureFormat === "celsius" || v1?.temperatureFormat === "fahrenheit" ? v1.temperatureFormat : "fahrenheit";
  const showFooterLogo = v1?.showFooterLogo === true;
  const colors = coerceCallSheetColors(v1?.colors);

  return {
    pageSize,
    spacing,
    timeFormat,
    tempFormat,
    showFooterLogo,
    colors,
  };
}

function buildSectionsFromLegacy(options: {
  legacyConfig: unknown;
  schedule: unknown;
}): CallSheetSectionV2[] {
  const { legacyConfig, schedule } = options;
  const v1 = isRecord(legacyConfig) ? (legacyConfig as Partial<CallSheetConfig>) : null;
  const legacySections = Array.isArray(v1?.sections) ? v1.sections : [];

  const fromLegacy = legacySections
    .map((section, idx) => {
      if (!isRecord(section)) return null;
      const id = typeof section.id === "string" ? section.id : `section-${idx}`;
      const type = typeof section.type === "string" ? section.type : "custom-banner";
      if (!SECTION_TYPES.has(type)) return null;
      const enabled = section.isVisible !== false;
      const order = coerceNumber(section.order, idx);
      const config = isRecord(section.config) ? section.config : {};
      const fields = type === "schedule" ? buildScheduleFields((schedule as any)?.columnConfig) : [];
      return { id, type, enabled, order, config, fields };
    })
    .filter(Boolean);

  if (fromLegacy.length > 0) {
    return fromLegacy.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  const scheduleFields = buildScheduleFields((schedule as any)?.columnConfig);
  return [
    { id: "section-header", type: "header", enabled: true, order: 0, config: {}, fields: [] },
    { id: "section-day-details", type: "day-details", enabled: true, order: 1, config: {}, fields: [] },
    { id: "section-reminders", type: "reminders", enabled: true, order: 2, config: {}, fields: [] },
    { id: "section-schedule", type: "schedule", enabled: true, order: 3, config: { viewMode: "parallel" }, fields: scheduleFields },
    { id: "section-talent", type: "talent", enabled: true, order: 4, config: {}, fields: [] },
    { id: "section-crew", type: "crew", enabled: true, order: 5, config: {}, fields: [] },
    { id: "section-notes", type: "notes-contacts", enabled: true, order: 6, config: {}, fields: [] },
  ];
}

export function buildCallSheetLayoutV2(options: {
  schedule: unknown;
  legacyCallSheetConfig?: unknown;
}): CallSheetLayoutV2 {
  const { schedule, legacyCallSheetConfig } = options;
  return {
    schemaVersion: CALL_SHEET_LAYOUT_V2_SCHEMA_VERSION,
    header: buildHeaderFromLegacy(legacyCallSheetConfig),
    sections: buildSectionsFromLegacy({ legacyConfig: legacyCallSheetConfig, schedule }),
    settings: buildSettingsFromLegacy(legacyCallSheetConfig),
  };
}
