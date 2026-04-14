import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export default function QuoteEditorCard({ section, onUpdateSectionConfig, readOnly = false }) {
  const sectionTitle = useMemo(() => {
    const raw = section?.config?.title;
    const title = raw != null ? String(raw) : "";
    return title.trim() ? title : "Quote of the Day";
  }, [section?.config?.title]);

  const quote = useMemo(() => {
    const raw = section?.config?.quote;
    return raw == null ? "" : String(raw);
  }, [section?.config?.quote]);

  const author = useMemo(() => {
    const raw = section?.config?.author;
    return raw == null ? "" : String(raw);
  }, [section?.config?.author]);

  const [draftTitle, setDraftTitle] = useState(sectionTitle);
  const [draftQuote, setDraftQuote] = useState(quote);
  const [draftAuthor, setDraftAuthor] = useState(author);

  useEffect(() => setDraftTitle(sectionTitle), [sectionTitle]);
  useEffect(() => setDraftQuote(quote), [quote]);
  useEffect(() => setDraftAuthor(author), [author]);

  if (!section) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{sectionTitle}</div>
            <div className="text-xs text-slate-500">Displayed near the end of the call sheet.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDraftTitle(sectionTitle);
                setDraftQuote(quote);
                setDraftAuthor(author);
              }}
              disabled={readOnly}
            >
              Reset
            </Button>
            <Button
              onClick={() => onUpdateSectionConfig?.(section.id, { title: draftTitle, quote: draftQuote, author: draftAuthor })}
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
            <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} disabled={readOnly} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Quote</span>
            <textarea
              value={draftQuote}
              onChange={(e) => setDraftQuote(e.target.value)}
              rows={4}
              placeholder="Enter a quote…"
              disabled={readOnly}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Author</span>
            <Input
              value={draftAuthor}
              onChange={(e) => setDraftAuthor(e.target.value)}
              placeholder="Author"
              disabled={readOnly}
            />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

