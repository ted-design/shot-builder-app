import React, { useMemo, useState } from "react";
import { Modal } from "../../ui/modal";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

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

function CheckboxRow({ checked, onChange, label, description }) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4"
      />
      <span className="min-w-0">
        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</div>
        {description ? <div className="text-xs text-slate-500">{description}</div> : null}
      </span>
    </label>
  );
}

export default function TemplatesModal({ open, onClose }) {
  const [tab, setTab] = useState("load"); // load | save

  const [loadTemplateId, setLoadTemplateId] = useState("");
  const [loadAll, setLoadAll] = useState(true);
  const [loadHeader, setLoadHeader] = useState(true);
  const [loadLayoutSections, setLoadLayoutSections] = useState(true);
  const [loadTableColumns, setLoadTableColumns] = useState(true);
  const [loadPageFooter, setLoadPageFooter] = useState(true);

  const [saveMode, setSaveMode] = useState("new"); // new | update
  const [templateName, setTemplateName] = useState("");
  const canLoad = useMemo(() => Boolean(loadTemplateId.trim()), [loadTemplateId]);
  const canSave = useMemo(() => Boolean(templateName.trim()), [templateName]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="callsheet-templates-title"
      describedBy="callsheet-templates-desc"
      contentClassName="!max-w-2xl !min-h-0"
    >
      <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div id="callsheet-templates-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Templates
            </div>
            <div id="callsheet-templates-desc" className="text-sm text-slate-500">
              Load or save call sheet layout/settings presets.
            </div>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-1 border-b border-slate-200 dark:border-slate-700">
          <TabButton active={tab === "load"} onClick={() => setTab("load")}>
            Load Template
          </TabButton>
          <TabButton active={tab === "save"} onClick={() => setTab("save")}>
            Save Template
          </TabButton>
        </div>
      </div>

      {tab === "load" ? (
        <div className="space-y-4 p-6">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            This is a UI scaffold; persistence + template management is implemented in Phase 9.
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Choose template to load</span>
            <Input
              value={loadTemplateId}
              onChange={(e) => setLoadTemplateId(e.target.value)}
              placeholder="Template ID (placeholder)"
            />
          </label>

          <div className="space-y-2">
            <CheckboxRow
              checked={loadAll}
              onChange={(next) => {
                setLoadAll(next);
                if (next) {
                  setLoadHeader(true);
                  setLoadLayoutSections(true);
                  setLoadTableColumns(true);
                  setLoadPageFooter(true);
                }
              }}
              label="Load all layout settings"
              description="Applies header, sections, and table columns."
            />
            <CheckboxRow checked={loadHeader} onChange={setLoadHeader} label="Header" />
            <CheckboxRow checked={loadLayoutSections} onChange={setLoadLayoutSections} label="Layout sections" />
            <CheckboxRow checked={loadTableColumns} onChange={setLoadTableColumns} label="Table columns" />
            <CheckboxRow checked={loadPageFooter} onChange={setLoadPageFooter} label="Page + footer settings" />
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Warning: Template loading can overwrite layout/visibility settings. (Phase 9 will apply real logic.)
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!canLoad} onClick={onClose}>
              Load
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "save" ? (
        <div className="space-y-4 p-6">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            This is a UI scaffold; persistence + template management is implemented in Phase 9.
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Save as</div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={saveMode === "new" ? "default" : "outline"}
                onClick={() => setSaveMode("new")}
              >
                New template
              </Button>
              <Button
                type="button"
                variant={saveMode === "update" ? "default" : "outline"}
                onClick={() => setSaveMode("update")}
              >
                Update existing
              </Button>
            </div>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Template name</span>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={saveMode === "new" ? "Classic layout" : "Existing template name"}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Visible to</span>
            <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option>Only Me</option>
              <option>Company</option>
            </select>
          </label>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!canSave} onClick={onClose}>
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

