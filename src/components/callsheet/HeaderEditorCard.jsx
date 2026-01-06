import React, { useMemo } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

function normalizeUrl(value) {
  const raw = value == null ? "" : String(value).trim();
  return raw;
}

export default function HeaderEditorCard({
  section,
  schedule,
  dayDetails,
  callSheetConfig,
  onUpdateSectionConfig,
  onUpdateCallSheetConfig,
}) {
  const config = section?.config && typeof section.config === "object" ? section.config : {};
  const title = config.title ?? "";
  const subtitle = config.subtitle ?? "";
  const companyName = config.companyName ?? "";
  const leftLogoUrl = config.leftLogoUrl ?? "";
  const centerLogoUrl = config.centerLogoUrl ?? "";
  const rightLogoUrl = config.rightLogoUrl ?? "";

  const headerLayout = callSheetConfig?.headerLayout || "classic";

  const derivedSubtitle = useMemo(() => {
    if (!schedule?.date) return "";
    const dateObj = schedule.date?.toDate ? schedule.date.toDate() : new Date(schedule.date);
    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [schedule?.date]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
              Header
            </div>
            <div className="text-xs text-slate-500">
              Controls the title block at the top of the call sheet.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={headerLayout}
              onChange={(e) => onUpdateCallSheetConfig?.({ headerLayout: e.target.value })}
            >
              <option value="classic">Classic</option>
              <option value="center-logo">Center logo</option>
              <option value="multiple-logos">Multiple logos</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-slate-500">Title</span>
          <Input
            value={title}
            placeholder={schedule?.name || "Call Sheet"}
            onChange={(e) => onUpdateSectionConfig?.(section.id, { title: e.target.value })}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-slate-500">Subtitle</span>
          <Input
            value={subtitle}
            placeholder={derivedSubtitle || "Schedule date"}
            onChange={(e) => onUpdateSectionConfig?.(section.id, { subtitle: e.target.value })}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-slate-500">Company name (optional)</span>
          <Input
            value={companyName}
            placeholder="Production company"
            onChange={(e) => onUpdateSectionConfig?.(section.id, { companyName: e.target.value })}
          />
        </label>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Left logo URL</span>
            <Input
              value={leftLogoUrl}
              placeholder="https://…"
              onChange={(e) =>
                onUpdateSectionConfig?.(section.id, { leftLogoUrl: normalizeUrl(e.target.value) })
              }
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Center logo URL</span>
            <Input
              value={centerLogoUrl}
              placeholder="https://…"
              onChange={(e) =>
                onUpdateSectionConfig?.(section.id, { centerLogoUrl: normalizeUrl(e.target.value) })
              }
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Right logo URL</span>
            <Input
              value={rightLogoUrl}
              placeholder="https://…"
              onChange={(e) =>
                onUpdateSectionConfig?.(section.id, { rightLogoUrl: normalizeUrl(e.target.value) })
              }
            />
          </label>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
          Preview data uses Day Details times:
          <span className="ml-2 font-medium">
            Crew {dayDetails?.crewCallTime || "—"}, Shoot {dayDetails?.shootingCallTime || "—"}, Wrap{" "}
            {dayDetails?.estimatedWrap || "—"}
          </span>
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onUpdateSectionConfig?.(section.id, {
                title: "",
                subtitle: "",
                companyName: "",
                leftLogoUrl: "",
                centerLogoUrl: "",
                rightLogoUrl: "",
              })
            }
          >
            Reset header fields
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

