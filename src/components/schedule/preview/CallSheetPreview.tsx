import React, { useState } from "react";
import { MapPin } from "lucide-react";
import type { CallSheetColors, CallSheetData } from "../types";
import type { CallSheetLayoutV2, CallSheetCenterShape } from "../../../types/callsheet";
import { CallSheetHeader, CallSheetHeaderCompact } from "./CallSheetHeader";
import { ScheduleTableSection } from "./sections/ScheduleTableSection";
import { TalentSection } from "./sections/TalentSection";
import { CrewSection } from "./sections/CrewSection";
import { DocumentPage } from "./primitives/DocumentPage";
import { DocSectionHeader } from "./primitives/DocSectionHeader";

interface CallSheetPreviewProps {
  data: CallSheetData;
  colors?: CallSheetColors;
  showMobile?: boolean;
  zoom?: number;
  layoutV2?: CallSheetLayoutV2 | null;
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

  const hasCrew = data.crew && data.crew.length > 0;

  // Extract centerShape from layoutV2 if available
  const centerShape: CallSheetCenterShape = layoutV2?.header?.centerShape || "circle";

  return (
    <div
      className="call-sheet-document-wrapper"
      style={{
        ...cssVars,
        transform: `scale(${zoom / 100})`,
        transformOrigin: "top center",
      }}
    >
      {/* Page 1 */}
      <DocumentPage showMobile={showMobile} className="mb-6" contentClassName={showMobile ? "p-4" : undefined}>
        {/* Header Section */}
        <CallSheetHeader
          projectName={data.projectName}
          version={data.version}
          groupName={data.groupName}
          shootDay={data.shootDay}
          date={data.date}
          dayNumber={data.dayNumber}
          totalDays={data.totalDays}
          crewCallTime={data.crewCallTime}
          centerShape={centerShape}
        />

        {/* Info Grid Section */}
        <InfoGridSection locations={data.locations} notes={data.notes} />

        {/* Today's Schedule Section */}
        <SectionWrapper title="Today's Schedule" collapsible>
          <ScheduleTableSection schedule={data.schedule} />
        </SectionWrapper>

        {/* Talent Section */}
        <SectionWrapper title="Talent">
          <TalentSection talent={data.talent} />
        </SectionWrapper>

        {/* Footer for Page 1 */}
        <CallSheetFooter />
      </DocumentPage>

      {/* Page 2 - Crew (only if there's crew data) */}
      {hasCrew && (
        <DocumentPage showMobile={showMobile} contentClassName={showMobile ? "p-4" : undefined}>
          {/* Compact Header for Page 2 */}
          <CallSheetHeaderCompact
            projectName={data.projectName}
            version={data.version}
            date={data.date}
            dayNumber={data.dayNumber}
            totalDays={data.totalDays}
            crewCallTime={data.crewCallTime}
            centerShape={centerShape}
          />

          {/* Crew Section */}
          <CrewSection crew={data.crew} />

          {/* Footer for Page 2 */}
          <CallSheetFooter />
        </DocumentPage>
      )}
    </div>
  );
}

/* ============================================
   Info Grid Section - Production Office, Hospital, etc.
   ============================================ */
interface InfoGridSectionProps {
  locations: CallSheetData["locations"];
  notes?: string;
}

function InfoGridSection({ locations, notes }: InfoGridSectionProps) {
  const productionOffice = locations.find((l) => l.type === "Production Office");
  const nearestHospital = locations.find((l) => l.type === "Nearest Hospital");

  // Use consistent doc-ink color for borders (no rounding, no shadows)
  const borderClass = "border-[var(--color-doc-ink,#111)]";

  return (
    <div className="mb-3">
      {/* Print-style bordered grid - SetHero parity: strict 1px black borders */}
      <div className={`border ${borderClass}`} style={{ borderRadius: 0 }}>
        {/* Row 1: Location Info - 2 columns */}
        <div className={`grid grid-cols-2`}>
          {/* Production Office Cell */}
          <div className={`px-1.5 py-1 border-r ${borderClass}`}>
            <div className="flex items-center gap-1 mb-0.5">
              <MapPin className="w-3 h-3 text-[var(--cs-primary)]" />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                Production Office
              </span>
            </div>
            {productionOffice ? (
              <>
                <p className="text-[11px] font-medium text-[var(--color-doc-ink,#111)] leading-tight">{productionOffice.name}</p>
                {productionOffice.address && (
                  <p className="text-[10px] text-gray-600 leading-tight">{productionOffice.address}</p>
                )}
              </>
            ) : (
              <p className="text-[10px] text-gray-400 italic">Not set</p>
            )}
          </div>

          {/* Nearest Hospital Cell */}
          <div className="px-1.5 py-1">
            <div className="flex items-center gap-1 mb-0.5">
              <MapPin className="w-3 h-3 text-red-500" />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                Nearest Hospital
              </span>
            </div>
            {nearestHospital ? (
              <>
                <p className="text-[11px] font-medium text-[var(--color-doc-ink,#111)] leading-tight">{nearestHospital.name}</p>
                {nearestHospital.address && (
                  <p className="text-[10px] text-gray-600 leading-tight">{nearestHospital.address}</p>
                )}
              </>
            ) : (
              <p className="text-[10px] text-gray-400 italic">Not set</p>
            )}
          </div>
        </div>

        {/* Row 2: Meta Fields - 4 columns */}
        <div className={`grid grid-cols-4 border-t ${borderClass}`}>
          <div className={`px-1.5 py-1 border-r ${borderClass}`}>
            <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Set Medic</p>
            <p className="text-[10px] text-[var(--color-doc-ink,#111)]">—</p>
          </div>
          <div className={`px-1.5 py-1 border-r ${borderClass}`}>
            <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Script Version</p>
            <p className="text-[10px] text-[var(--color-doc-ink,#111)]">—</p>
          </div>
          <div className={`px-1.5 py-1 border-r ${borderClass}`}>
            <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Schedule Version</p>
            <p className="text-[10px] text-[var(--color-doc-ink,#111)]">—</p>
          </div>
          <div className="px-1.5 py-1">
            <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Key People</p>
            <p className="text-[10px] text-[var(--color-doc-ink,#111)]">—</p>
          </div>
        </div>
      </div>

      {/* Notes Section - Below grid (same border treatment, no bg) */}
      {notes && (
        <div className={`mt-1 border ${borderClass} px-1.5 py-1`} style={{ borderRadius: 0 }}>
          <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Notes</p>
          <p className="text-[10px] text-[var(--color-doc-ink,#111)] leading-tight">{notes}</p>
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
