import React, { useState } from "react";
import { MapPin } from "lucide-react";
import type { CallSheetColors, CallSheetData } from "../types";
import type { CallSheetLayoutV2, CallSheetCenterShape, CallSheetSection, CallSheetHeaderItem, ScheduleBlockFields } from "../../../types/callsheet";
import type { ColumnConfig } from "../../../types/schedule";
import { CallSheetHeader, CallSheetHeaderCompact } from "./CallSheetHeader";
import { ScheduleTableSection } from "./sections/ScheduleTableSection";
import { ScheduleBlockSection } from "./sections/ScheduleBlockSection";
import { TalentSection } from "./sections/TalentSection";
import { CrewSection } from "./sections/CrewSection";
import { DocumentPage } from "./primitives/DocumentPage";
import { DocSectionHeader } from "./primitives/DocSectionHeader";
import { paginateCallSheetSections } from "./paginateCallSheetSections";

import { formatNotesForDisplay } from "../../../lib/sanitize";
import { readSectionTitle } from "../../../lib/callsheet/readSectionTitle";
import { buildCallSheetVariableContext } from "../../../lib/callsheet/variables";

// Feature flag: Use block preview v1 for schedule section
// Set to false to revert to table view
const USE_SCHEDULE_BLOCK_PREVIEW = true;

interface CrewDisplayOptions {
  showEmails?: boolean;
  showPhones?: boolean;
  departmentOrder?: string[] | null;
}

interface CallSheetPreviewProps {
  data: CallSheetData;
  colors?: CallSheetColors;
  showMobile?: boolean;
  zoom?: number;
  layoutV2?: CallSheetLayoutV2 | null;
  sections?: CallSheetSection[] | null;
  crewDisplayOptions?: CrewDisplayOptions;
  columnConfig?: ColumnConfig[];
  scheduleBlockFields?: ScheduleBlockFields | null;
}

const DEFAULT_COLORS: CallSheetColors = {
  primary: "#2a3f5f",      // Dark navy for headers (SetHero)
  primaryText: "#ffffff",
  accent: "#fc5b54",       // Red accent
  rowAlternate: "#f8fafc", // Light gray for alternating rows
};

export function CallSheetPreview({
  data,
  colors = DEFAULT_COLORS,
  showMobile = false,
  zoom = 100,
  layoutV2,
  sections,
  crewDisplayOptions,
  columnConfig,
  scheduleBlockFields,
}: CallSheetPreviewProps) {
  const cssVars = {
    "--cs-primary": colors.primary,
    "--cs-primary-text": colors.primaryText,
    "--cs-accent": colors.accent,
    "--cs-row-alt": colors.rowAlternate,
    "--cs-header-bg": "#2a3f5f",
    "--cs-border": "#e5e7eb",
    "--cs-text-muted": "#9ca3af",
  } as React.CSSProperties;

  const pages = React.useMemo(() => paginateCallSheetSections(sections), [sections]);
  const isHeaderVisible = React.useMemo(() => {
    const list = Array.isArray(sections) ? sections : [];
    const header = list.find((section) => section?.type === "header");
    return header ? header.isVisible !== false : true;
  }, [sections]);

  // Extract centerShape from layoutV2 if available
  const centerShape: CallSheetCenterShape = layoutV2?.header?.centerShape || "circle";

  // Build variable context for header items
  // projectTitle uses the real project name if provided, falling back to schedule name
  const variableContext = React.useMemo(() => {
    return buildCallSheetVariableContext({
      schedule: { name: data.projectName, date: data.date },
      dayDetails: data.dayDetails,
      projectTitle: data.projectTitle ?? data.projectName,
      companyName: data.groupName,
      totalDays: data.totalDays,
      dayNumber: data.dayNumber,
    });
  }, [data.projectName, data.projectTitle, data.date, data.dayDetails, data.groupName, data.totalDays, data.dayNumber]);

  // Extract header items from layoutV2 if available
  const headerItems = React.useMemo(() => {
    const header = layoutV2?.header;
    if (!header) return null;
    const items = {
      left: header.left?.items || [],
      center: header.center?.items || [],
      right: header.right?.items || [],
    };
    // Only use if at least one enabled item exists
    const hasEnabledItems = [...items.left, ...items.center, ...items.right].some((item) => item.enabled);
    return hasEnabledItems ? items : null;
  }, [layoutV2?.header]);

  return (
    <div
      className="call-sheet-document-wrapper"
      style={{
        ...cssVars,
        transform: `scale(${zoom / 100})`,
        transformOrigin: "top center",
      }}
    >
      {pages.map((pageSections, pageIndex) => {
        const pageHasHeader = pageSections.some((section) => section.type === "header");
        const pageChromeHeader =
          pageIndex > 0 && isHeaderVisible && !pageHasHeader ? (
            <CallSheetHeaderCompact
              projectName={data.projectName}
              version={data.version}
              date={data.date}
              dayNumber={data.dayNumber}
              totalDays={data.totalDays}
              crewCallTime={data.crewCallTime}
              centerShape={centerShape}
            />
          ) : null;

        return (
          <DocumentPage
            key={`page-${pageIndex}`}
            showMobile={showMobile}
            className={pageIndex < pages.length - 1 ? "mb-6" : undefined}
            contentClassName={showMobile ? "p-4" : undefined}
          >
            {pageChromeHeader}
            {pageSections.map((section) => (
              <React.Fragment key={section.id}>{renderSection(section, data, centerShape, pageIndex, crewDisplayOptions, headerItems, variableContext, columnConfig, data.tracks, scheduleBlockFields)}</React.Fragment>
            ))}
            <CallSheetFooter />
          </DocumentPage>
        );
      })}
    </div>
  );
}

function RemindersSection({ text }: { text: string }) {
  const items = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (items.length === 0) {
    return <div className="p-4 text-center text-sm text-gray-500 italic">No reminders.</div>;
  }

  return (
    <ul className="list-disc space-y-1 p-4 pl-8 text-sm text-gray-700">
      {items.map((item, idx) => (
        <li key={`${idx}-${item}`} className="break-words">
          {item}
        </li>
      ))}
    </ul>
  );
}

function renderSection(
  section: CallSheetSection,
  data: CallSheetData,
  centerShape: CallSheetCenterShape,
  pageIndex: number,
  crewDisplayOptions?: CrewDisplayOptions,
  headerItems?: { left: CallSheetHeaderItem[]; center: CallSheetHeaderItem[]; right: CallSheetHeaderItem[] } | null,
  variableContext?: Record<string, string>,
  columnConfig?: ColumnConfig[],
  tracks?: CallSheetData["tracks"],
  scheduleBlockFields?: ScheduleBlockFields | null
) {
  if (section.isVisible === false) return null;

  if (section.type === "header") {
    // Honor user-configured title from section config, fall back to data.projectName
    const headerTitle = readSectionTitle(section, data.projectName);
    if (pageIndex === 0) {
      return (
        <CallSheetHeader
          projectName={headerTitle}
          version={data.version}
          groupName={data.groupName}
          shootDay={data.shootDay}
          date={data.date}
          dayNumber={data.dayNumber}
          totalDays={data.totalDays}
          crewCallTime={data.crewCallTime}
          centerShape={centerShape}
          headerItems={headerItems ?? undefined}
          variableContext={variableContext}
          dayDetails={data.dayDetails}
        />
      );
    }
    return (
      <CallSheetHeaderCompact
        projectName={headerTitle}
        version={data.version}
        date={data.date}
        dayNumber={data.dayNumber}
        totalDays={data.totalDays}
        crewCallTime={data.crewCallTime}
        centerShape={centerShape}
      />
    );
  }

  if (section.type === "notes-contacts") {
    // The modern preview template does not yet have a dedicated Notes/Contacts section
    // beyond what's already represented in the Day Details info grid.
    return null;
  }

  if (section.type === "schedule") {
    return (
      <SectionWrapper title={readSectionTitle(section, "Today's Schedule")} collapsible>
        {USE_SCHEDULE_BLOCK_PREVIEW ? (
          <ScheduleBlockSection schedule={data.schedule} tracks={tracks} blockFields={scheduleBlockFields} />
        ) : (
          <ScheduleTableSection schedule={data.schedule} columnConfig={columnConfig} tracks={tracks} />
        )}
      </SectionWrapper>
    );
  }

  if (section.type === "talent") {
    return (
      <SectionWrapper title={readSectionTitle(section, "Talent")}>
        <TalentSection talent={data.talent} />
      </SectionWrapper>
    );
  }

  if (section.type === "crew") {
    return (
      <SectionWrapper title={readSectionTitle(section, "Crew")}>
        <CrewSection crew={data.crew || []} displayOptions={crewDisplayOptions} />
      </SectionWrapper>
    );
  }

  if (section.type === "day-details") {
    // Restore the prior template: the "info grid" block belongs directly under the header.
    return <InfoGridSection locations={data.locations} notes={data.notes} meta={data.dayDetails} />;
  }

  if (section.type === "reminders") {
    const raw = (section?.config as Record<string, unknown> | undefined)?.text;
    const text = typeof raw === "string" ? raw : "";
    return (
      <SectionWrapper title={readSectionTitle(section, "Reminders")}>
        <RemindersSection text={text} />
      </SectionWrapper>
    );
  }

  if (section.type === "page-break") {
    return null;
  }

  return null;
}

/* ============================================
   Info Grid Section - Production Office, Hospital, etc.
   ============================================ */
interface InfoGridSectionProps {
  locations: CallSheetData["locations"];
  notes?: string;
  meta?: CallSheetData["dayDetails"] | null;
}

function InfoGridSection({ locations, notes, meta }: InfoGridSectionProps) {
  // Helper to check if a value is non-empty (trim strings; treat whitespace as empty)
  const hasValue = (v: unknown): v is string | number => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim().length > 0;
    return true;
  };

  // Build array of meta fields that have actual values (filter before rendering)
  const metaFields: { label: string; value: string }[] = [];
  if (hasValue(meta?.setMedic)) {
    metaFields.push({ label: "Set Medic", value: String(meta.setMedic).trim() });
  }
  if (hasValue(meta?.scriptVersion)) {
    metaFields.push({ label: "Script Version", value: String(meta.scriptVersion).trim() });
  }
  if (hasValue(meta?.scheduleVersion)) {
    metaFields.push({ label: "Schedule Version", value: String(meta.scheduleVersion).trim() });
  }
  if (hasValue(meta?.keyPeople)) {
    metaFields.push({ label: "Key People", value: String(meta.keyPeople).trim() });
  }

  const rawNotes = meta?.notes != null ? String(meta.notes) : notes != null ? String(notes) : "";
  const hasNotes = Boolean(rawNotes.trim());
  const notesHtml = hasNotes ? formatNotesForDisplay(rawNotes) : "";

  // Filter locations to only include those with valid names
  const validLocations = locations.filter((loc) => hasValue(loc.name));

  // For 2+ locations, pair them for the 2-column layout
  const pairs: [CallSheetData["locations"][number], CallSheetData["locations"][number] | undefined][] = [];
  for (let i = 0; i < validLocations.length; i += 2) {
    pairs.push([validLocations[i], validLocations[i + 1]]);
  }

  // Use consistent doc-ink color for borders (no rounding, no shadows)
  const borderClass = "border-[var(--color-doc-ink,#111)]";

  // Dynamic grid columns based on number of populated meta fields
  const metaGridCols =
    metaFields.length === 1
      ? "grid-cols-1"
      : metaFields.length === 2
        ? "grid-cols-2"
        : metaFields.length === 3
          ? "grid-cols-3"
          : "grid-cols-4";

  // Render a single location box (used for both single and multi-location layouts)
  // When centered=true, content is center-justified (for single-location tile)
  const renderLocationBox = (location: CallSheetData["locations"][number], bordered: boolean, centered = false) => {
    const iconClassName = location.type === "Nearest Hospital" ? "text-red-500" : "text-[var(--cs-primary)]";
    const textAlign = centered ? "text-center" : "";
    const labelJustify = centered ? "justify-center" : "";
    return (
      <div className={bordered ? `px-1.5 py-1 border-r ${borderClass}` : "px-1.5 py-1"}>
        <div className={`flex items-center gap-1 mb-0.5 ${labelJustify}`}>
          <MapPin className={`w-3 h-3 ${iconClassName}`} />
          <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">
            {location.type}
          </span>
        </div>
        <p className={`text-[11px] font-medium text-[var(--color-doc-ink,#111)] leading-tight ${textAlign}`}>
          {location.name}
        </p>
        {location.address ? (
          <p className={`text-[10px] text-gray-600 leading-tight ${textAlign}`}>{location.address}</p>
        ) : null}
      </div>
    );
  };

  // Render empty placeholder for 2-column grid
  const renderEmptyCell = (bordered: boolean) => (
    <div className={bordered ? `px-1.5 py-1 border-r ${borderClass}` : "px-1.5 py-1"} />
  );

  return (
    <div className="mb-3">
      {/* Single location: render as centered tile with its own border */}
      {validLocations.length === 1 ? (
        <div className="flex justify-center mb-1">
          <div className={`border ${borderClass} w-fit max-w-[360px]`} style={{ borderRadius: 0 }}>
            {renderLocationBox(validLocations[0], false, true)}
          </div>
        </div>
      ) : (
        /* Multiple locations: full-width bordered grid */
        <div className={`border ${borderClass}`} style={{ borderRadius: 0 }}>
          {pairs.map(([left, right], index) => {
            const rowBorder = index > 0 ? `border-t ${borderClass}` : "";
            return (
              <div key={`${index}-${left.type}`} className={`grid grid-cols-2 ${rowBorder}`}>
                {renderLocationBox(left, true)}
                {right ? renderLocationBox(right, false) : renderEmptyCell(false)}
              </div>
            );
          })}
        </div>
      )}

      {/* Meta Fields Row - separate bordered container */}
      {metaFields.length > 0 && (
        <div className={`border ${borderClass} ${validLocations.length === 1 ? "" : "border-t-0"}`} style={{ borderRadius: 0 }}>
          <div className={`grid ${metaGridCols}`}>
            {metaFields.map((field, idx) => {
              const isLast = idx === metaFields.length - 1;
              return (
                <div key={field.label} className={isLast ? "px-1.5 py-1" : `px-1.5 py-1 border-r ${borderClass}`}>
                  <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                    {field.label}
                  </p>
                  <p className="text-[10px] text-[var(--color-doc-ink,#111)]">{field.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes Section - Below grid (same border treatment, no bg) */}
      {hasNotes && (
        <div className={`mt-1 border ${borderClass} px-1.5 py-1`} style={{ borderRadius: 0 }}>
          <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Main Notes</p>
          <div
            className="text-[10px] text-[var(--color-doc-ink,#111)] leading-tight"
            dangerouslySetInnerHTML={{ __html: notesHtml }}
          />
        </div>
      )}
    </div>
  );
}

/* ============================================
   Section Wrapper - Print-style label (SetHero parity)
   ============================================ */
interface SectionWrapperProps {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
}

function SectionWrapper({ title, children, collapsible }: SectionWrapperProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section className="mb-4">
      <DocSectionHeader
        title={title}
        variant="inlineLabel"
        collapsible={Boolean(collapsible)}
        expanded={isExpanded}
        onToggle={() => setIsExpanded((prev) => !prev)}
      />
      {isExpanded && children}
    </section>
  );
}

/* ============================================
   Footer - Powered by branding
   ============================================ */
function CallSheetFooter() {
  return (
    <footer className="mt-auto pt-4 pb-1">
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
        <img
          src="/images/brands/immediate-logo-black.png"
          alt="Immediate"
          className="h-5 opacity-60"
          onError={(e) => {
            // Hide if image fails to load
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <span>Powered by Immediate</span>
      </div>
      <p className="text-center text-[10px] text-gray-400 mt-1">
        Send better call sheets
      </p>
    </footer>
  );
}
