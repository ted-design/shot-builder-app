import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `extras-${Date.now()}`;
}

function normalizeRows(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const id = row.id ? String(row.id) : makeId();
      return {
        id,
        title: row.title != null ? String(row.title) : "",
        text: row.text != null ? String(row.text) : "",
      };
    })
    .filter(Boolean);
}

export default function ExtrasEditorCard({ section, onUpdateSectionConfig, readOnly = false }) {
  const rowsFromConfig = useMemo(() => normalizeRows(section?.config?.rows), [section?.config?.rows]);
  const sectionTitle = useMemo(() => {
    const raw = section?.config?.title;
    const title = raw != null ? String(raw) : "";
    return title.trim() ? title : "Extras & Dept. Notes";
  }, [section?.config?.title]);

  const [draftTitle, setDraftTitle] = useState(sectionTitle);
  const [draftRows, setDraftRows] = useState(rowsFromConfig);

  useEffect(() => {
    setDraftTitle(sectionTitle);
  }, [sectionTitle]);

  useEffect(() => {
    setDraftRows(rowsFromConfig);
  }, [rowsFromConfig]);

  if (!section) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
              {sectionTitle}
            </div>
            <div className="text-xs text-slate-500">Department notes and extras call sheet content.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDraftTitle(sectionTitle);
                setDraftRows(rowsFromConfig);
              }}
              disabled={readOnly}
            >
              Reset
            </Button>
            <Button
              onClick={() => {
                onUpdateSectionConfig?.(section.id, { title: String(draftTitle || ""), rows: draftRows });
              }}
              disabled={readOnly}
            >
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Section title</span>
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Extras & Dept. Notes"
              disabled={readOnly}
            />
          </label>

          <div className="flex justify-between gap-2">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Rows</div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDraftRows((prev) => [...prev, { id: makeId(), title: "", text: "" }])}
              disabled={readOnly}
            >
              + Add row
            </Button>
          </div>

          {draftRows.length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
              No rows yet. Add a row for Extras or a Department note.
            </div>
          ) : (
            <div className="space-y-3">
              {draftRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={row.title}
                      onChange={(e) =>
                        setDraftRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, title: e.target.value } : r))
                        )
                      }
                      placeholder="Row title (e.g., Background / Wardrobe / Camera)"
                      disabled={readOnly}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDraftRows((prev) => prev.filter((r) => r.id !== row.id))}
                      disabled={readOnly}
                    >
                      Remove
                    </Button>
                  </div>
                  <textarea
                    value={row.text}
                    onChange={(e) =>
                      setDraftRows((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, text: e.target.value } : r))
                      )
                    }
                    rows={4}
                    placeholder="Notes…"
                    disabled={readOnly}
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

