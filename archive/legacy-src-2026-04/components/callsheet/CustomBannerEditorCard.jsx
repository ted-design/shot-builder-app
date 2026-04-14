import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export default function CustomBannerEditorCard({ section, onUpdateSectionConfig }) {
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
              Custom banner
            </div>
            <div className="text-xs text-slate-500">Displayed as a banner section.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setDraft(sectionText)}>
              Reset
            </Button>
            <Button
              onClick={() => {
                const next = (draft || "").trim();
                onUpdateSectionConfig?.(section.id, { text: next || "Banner" });
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Text</span>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Banner text"
            />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

