import React, { useState } from "react";
import { Calendar, ChevronDown, Star, Users, MapPin, ExternalLink } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { CallSheetColors, CallSheetData } from "../types";
import type { CallSheetLayoutV2, CallSheetCenterShape } from "../../../types/callsheet";
import { CallSheetHeader, CallSheetHeaderCompact } from "./CallSheetHeader";
import { ScheduleTableSection } from "./sections/ScheduleTableSection";
import { TalentSection } from "./sections/TalentSection";
import { CrewSection } from "./sections/CrewSection";

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
      <div
        className={cn(
          "call-sheet-page bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] mx-auto mb-6",
          showMobile ? "w-[375px]" : "w-[8.5in]"
        )}
        style={{ minHeight: showMobile ? "auto" : "11in" }}
      >
        <div className={cn("p-6", showMobile && "p-4")}>
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
          <SectionWrapper
            icon={Calendar}
            title="Today's Schedule"
            collapsible
          >
            <ScheduleTableSection schedule={data.schedule} />
          </SectionWrapper>

          {/* Talent Section */}
          <SectionWrapper icon={Star} title="Talent">
            <TalentSection talent={data.talent} />
          </SectionWrapper>

          {/* Footer for Page 1 */}
          <CallSheetFooter />
        </div>
      </div>

      {/* Page 2 - Crew (only if there's crew data) */}
      {hasCrew && (
        <div
          className={cn(
            "call-sheet-page bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] mx-auto",
            showMobile ? "w-[375px]" : "w-[8.5in]"
          )}
          style={{ minHeight: showMobile ? "auto" : "11in" }}
        >
          <div className={cn("p-6", showMobile && "p-4")}>
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
          </div>
        </div>
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

  return (
    <div className="mb-4">
      {/* Row 1: Location Cards - SetHero style clean 2-column grid */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        {/* Production Office Card */}
        <div className="border border-[var(--cs-border)] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-[var(--cs-primary)]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Production Office
            </span>
          </div>
          {productionOffice ? (
            <>
              <p className="text-sm font-medium text-gray-900">{productionOffice.name}</p>
              {productionOffice.address && (
                <p className="text-xs text-gray-500 mt-0.5">{productionOffice.address}</p>
              )}
            </>
          ) : (
            <p className="text-xs text-[var(--cs-text-muted)] italic">Not set</p>
          )}
        </div>

        {/* Nearest Hospital Card */}
        <div className="border border-[var(--cs-border)] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-red-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Nearest Hospital
            </span>
          </div>
          {nearestHospital ? (
            <>
              <p className="text-sm font-medium text-gray-900">{nearestHospital.name}</p>
              {nearestHospital.address && (
                <p className="text-xs text-gray-500 mt-0.5">{nearestHospital.address}</p>
              )}
            </>
          ) : (
            <p className="text-xs text-[var(--cs-text-muted)] italic">Not set</p>
          )}
        </div>
      </div>

      {/* Row 2: Info Grid - SetHero style 4-column layout */}
      <div className="border border-[var(--cs-border)] rounded-lg">
        <div className="grid grid-cols-4 divide-x divide-[var(--cs-border)]">
          <div className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Set Medic</p>
            <p className="text-sm text-gray-700">—</p>
          </div>
          <div className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Script Version</p>
            <p className="text-sm text-gray-700">—</p>
          </div>
          <div className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Schedule Version</p>
            <p className="text-sm text-gray-700">—</p>
          </div>
          <div className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Key People</p>
            <p className="text-sm text-gray-700">—</p>
          </div>
        </div>
      </div>

      {/* Row 3: Notes Section */}
      {notes && (
        <div className="mt-3 border border-[var(--cs-border)] rounded-lg p-3 bg-slate-50">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Notes</p>
          <p className="text-sm text-gray-700">{notes}</p>
        </div>
      )}
    </div>
  );
}

/* ============================================
   Section Wrapper - Full-width header bar (SetHero style)
   ============================================ */
interface SectionWrapperProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
}

function SectionWrapper({ icon: Icon, title, children, collapsible }: SectionWrapperProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section className="mb-4">
      <header
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          "bg-white border border-[var(--cs-border)] border-b-0",
          collapsible ? "cursor-pointer select-none" : ""
        )}
        onClick={() => {
          if (!collapsible) return;
          setIsExpanded((prev) => !prev);
        }}
      >
        <Icon className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        {collapsible && (
          <ChevronDown
            className={cn(
              "w-4 h-4 ml-1 text-gray-500 transition-transform",
              isExpanded ? "" : "-rotate-90"
            )}
          />
        )}
      </header>
      {isExpanded && (
        <div className="border border-[var(--cs-border)]">
          {children}
        </div>
      )}
    </section>
  );
}

/* ============================================
   Footer - Powered by branding
   ============================================ */
function CallSheetFooter() {
  return (
    <footer className="mt-auto pt-6 pb-2">
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
