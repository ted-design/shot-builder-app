import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";

export default function RemindersEditorCard({ section, onUpdateSectionConfig }) {
  const sectionText = useMemo(() => {
    const raw = section?.config?.text;
    return raw == null ? "" : String(raw);
  }, [section?.config?.text]);

  const [draft, setDraft] = useState(sectionText);

  useEffect(() => {
    setDraft(sectionText);
  }, [sectionText]);

  if (!section) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
              Reminders
            </div>
            <div className="text-xs text-slate-500">One reminder per line.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setDraft(sectionText)}>
              Reset
            </Button>
            <Button
              onClick={() => {
                const next = draft || "";
                onUpdateSectionConfig?.(section.id, { text: next });
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={8}
          placeholder={"Call sheet reminders...\n• Parking instructions\n• Wardrobe notes\n• Safety notes"}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </CardContent>
    </Card>
  );
}

