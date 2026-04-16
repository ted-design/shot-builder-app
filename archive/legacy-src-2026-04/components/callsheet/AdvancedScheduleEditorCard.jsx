import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export default function AdvancedScheduleEditorCard({ section, onUpdateSectionConfig, readOnly = false }) {
  const sectionTitle = useMemo(() => {
    const raw = section?.config?.title;
    const title = raw != null ? String(raw) : "";
    return title.trim() ? title : "Advanced Schedule";
  }, [section?.config?.title]);

  const sectionText = useMemo(() => {
    const raw = section?.config?.text;
    return raw == null ? "" : String(raw);
  }, [section?.config?.text]);

  const [draftTitle, setDraftTitle] = useState(sectionTitle);
  const [draftText, setDraftText] = useState(sectionText);

  useEffect(() => {
    setDraftTitle(sectionTitle);
  }, [sectionTitle]);

  useEffect(() => {
    setDraftText(sectionText);
  }, [sectionText]);

  if (!section) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{sectionTitle}</div>
            <div className="text-xs text-slate-500">Freeform block for advanced schedule notes (Phase 7 baseline).</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDraftTitle(sectionTitle);
                setDraftText(sectionText);
              }}
              disabled={readOnly}
            >
              Reset
            </Button>
            <Button
              onClick={() => onUpdateSectionConfig?.(section.id, { title: draftTitle, text: draftText })}
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
              placeholder="Advanced Schedule"
              disabled={readOnly}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Content</span>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={8}
              placeholder={"Advanced schedule notes...\n• Second unit\n• Inserts\n• Pickup list"}
              disabled={readOnly}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

