import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "../../ui/button";
import LayoutPanel from "./LayoutPanel";
import EditorPanel from "./EditorPanel";

function sectionLabel(type) {
  const labels = {
    header: "Header",
    "day-details": "Day Details",
    reminders: "Reminders",
    schedule: "Today’s Schedule",
    clients: "Clients",
    talent: "Talent",
    extras: "Extras",
    "advanced-schedule": "Advanced Schedule",
    "page-break": "Page Break",
    crew: "Crew",
    "notes-contacts": "Notes / Contacts",
    "custom-banner": "Custom Banner",
    quote: "Quote of the Day",
  };
  return labels[type] || type;
}

function TabButton({ active, children, ...props }) {
  return (
    <button
      type="button"
      className={[
        "relative px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "text-slate-900 dark:text-slate-100"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
      ].join(" ")}
      {...props}
    >
      {children}
      {active ? (
        <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-blue-600" />
      ) : null}
    </button>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      title={label}
    >
      <span
        className={[
          "h-4 w-7 rounded-full transition-colors",
          checked ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700",
        ].join(" ")}
      >
        <span
          className={[
            "block h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-3" : "translate-x-0",
          ].join(" ")}
        />
      </span>
      <span className="hidden sm:inline">{checked ? "On" : "Off"}</span>
    </button>
  );
}

function SettingsPanel({ config, onUpdateConfig }) {
  const pageSize = config?.pageSize || "auto";
  const spacing = config?.spacing || "normal";
  const timeFormat = config?.timeFormat || "12h";
  const temperatureFormat = config?.temperatureFormat || "fahrenheit";
  const showFooterLogo = config?.showFooterLogo === true;
  const colors = config?.colors && typeof config.colors === "object" ? config.colors : {};
  const primary = colors.primary || "#0F172A";
  const accent = colors.accent || "#2563EB";
  const text = colors.text || "#0F172A";
  const background = colors.background || "#FFFFFF";

  const updateColors = (updates) => {
    onUpdateConfig?.({ colors: { ...colors, ...updates } });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Call Sheet Settings</div>
      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-slate-500">Page size</span>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={pageSize}
          onChange={(e) => onUpdateConfig?.({ pageSize: e.target.value })}
        >
          <option value="auto">Auto</option>
          <option value="letter">Letter</option>
          <option value="a4">A4</option>
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-slate-500">Spacing</span>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={spacing}
          onChange={(e) => onUpdateConfig?.({ spacing: e.target.value })}
        >
          <option value="compact">Compact</option>
          <option value="normal">Normal</option>
          <option value="relaxed">Relaxed</option>
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-slate-500">Time format</span>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={timeFormat}
          onChange={(e) => onUpdateConfig?.({ timeFormat: e.target.value })}
        >
          <option value="12h">12-hour</option>
          <option value="24h">24-hour</option>
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium text-slate-500">Temperature format</span>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={temperatureFormat}
          onChange={(e) => onUpdateConfig?.({ temperatureFormat: e.target.value })}
        >
          <option value="fahrenheit">Fahrenheit</option>
          <option value="celsius">Celsius</option>
        </select>
      </label>

      <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">Footer logo</div>
          <div className="text-xs text-slate-500">Show footer logo on export.</div>
        </div>
        <Switch
          checked={showFooterLogo}
          onChange={(next) => onUpdateConfig?.({ showFooterLogo: next })}
          label="Footer logo"
        />
      </div>

      <div className="pt-2">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Colors
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="text-sm text-slate-700 dark:text-slate-200">Primary</div>
            <input
              type="color"
              value={primary}
              onChange={(e) => updateColors({ primary: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded"
              aria-label="Primary color"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="text-sm text-slate-700 dark:text-slate-200">Accent</div>
            <input
              type="color"
              value={accent}
              onChange={(e) => updateColors({ accent: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded"
              aria-label="Accent color"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="text-sm text-slate-700 dark:text-slate-200">Text</div>
            <input
              type="color"
              value={text}
              onChange={(e) => updateColors({ text: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded"
              aria-label="Text color"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="text-sm text-slate-700 dark:text-slate-200">Background</div>
            <input
              type="color"
              value={background}
              onChange={(e) => updateColors({ background: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded"
              aria-label="Background color"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onUpdateConfig?.({
                colors: {
                  primary: "#0F172A",
                  accent: "#2563EB",
                  text: "#0F172A",
                  background: "#FFFFFF",
                },
              })
            }
          >
            Reset colors
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BuilderPanel({
  sections,
  activeSectionId,
  onSelectSection,
  onReorderSections,
  onToggleSection,
  onAddSection,
  onDeleteSection,
  clientId,
  projectId,
  scheduleId,
  scheduleEditor,
  generalCrewCallTime,
  onUpdateSectionConfig,
  schedule,
  dayDetails,
  config,
  onUpdateConfig,
}) {
  const [mode, setMode] = useState("section"); // outline | settings | files | section

  const activeSection = useMemo(() => {
    return (sections || []).find((s) => s.id === activeSectionId) || null;
  }, [activeSectionId, sections]);

  const activeTitle = activeSection ? sectionLabel(activeSection.type) : "Section";
  const activeVisible = activeSection ? activeSection.isVisible !== false : true;

  useEffect(() => {
    if (mode === "section" && !activeSection) {
      setMode("outline");
    }
  }, [activeSection, mode]);

  const handleSelectFromOutline = useCallback(
    (sectionId) => {
      onSelectSection(sectionId);
      setMode("section");
    },
    [onSelectSection]
  );

  const handleBackToOutline = useCallback(() => {
    setMode("outline");
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {mode === "section" && activeSection ? (
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleBackToOutline}
              aria-label="Back to outline"
              title="Back to outline"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                {activeTitle}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={activeVisible}
              onChange={(next) => onToggleSection?.(activeSection.id, next)}
              label="Toggle section"
            />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBackToOutline}>
              <Check className="h-4 w-4" />
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 dark:border-slate-700 dark:bg-slate-800">
          <TabButton active={mode === "outline"} onClick={() => setMode("outline")}>
            Outline
          </TabButton>
          <TabButton active={mode === "settings"} onClick={() => setMode("settings")}>
            Settings
          </TabButton>
          <TabButton active={mode === "files"} onClick={() => setMode("files")}>
            File Attach
          </TabButton>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {mode === "outline" ? (
          <div className="p-3">
            <LayoutPanel
              title="Layout"
              sections={sections}
              activeSectionId={activeSectionId}
              onSelectSection={handleSelectFromOutline}
              onReorderSections={onReorderSections}
              onToggleSection={onToggleSection}
              onAddSection={onAddSection}
              onDeleteSection={onDeleteSection}
            />
          </div>
        ) : null}

        {mode === "settings" ? (
          <SettingsPanel config={config} onUpdateConfig={onUpdateConfig} />
        ) : null}

        {mode === "files" ? (
          <div className="p-4 text-sm text-slate-600 dark:text-slate-400">
            File attachments aren’t implemented yet.
          </div>
        ) : null}

        {mode === "section" && activeSection ? (
          <div className="h-full p-3">
            <EditorPanel
              activeSection={activeSection}
              clientId={clientId}
              projectId={projectId}
              scheduleId={scheduleId}
              schedule={schedule}
              dayDetails={dayDetails}
              callSheetConfig={config}
              onUpdateCallSheetConfig={onUpdateConfig}
              scheduleEditor={scheduleEditor}
              generalCrewCallTime={generalCrewCallTime}
              onUpdateSectionConfig={onUpdateSectionConfig}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
