/**
 * ProfileCanvas — Workspace Stage with Tabs (R.7)
 *
 * DESIGN PHILOSOPHY (Products V3 parity):
 * - "Workspace within workspace" — stable stage container
 * - Summary metrics band for quick scanning
 * - Inner tabs for subsurfaces (Overview, Measurements/Role, Gallery, Notes)
 * - Designed empty states with next-action guidance
 *
 * R.7 DESIGN UPGRADE:
 * - Workspace stage (white card with subtle border/shadow)
 * - Summary band: Completeness, Last Updated, Usage slots
 * - Type-aware tabs: Talent vs Crew have different tab sets
 * - Editorial empty states (not "Not provided")
 *
 * TAB STRUCTURE:
 * - Talent: Overview, Measurements, Gallery, Notes
 * - Crew: Overview, Role, Notes
 */

import { useCallback, useMemo, useState } from "react";
import {
  User,
  Users,
  X,
  CheckCircle2,
  Clock,
  Link2,
  ImageIcon,
  FileText,
  Briefcase,
  Ruler,
} from "lucide-react";
import Thumb from "../Thumb";
import InlineEditField from "./InlineEditField";
import { stripHtml } from "../../lib/stripHtml";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";

// ============================================================================
// MEASUREMENTS DISPLAY HELPERS
// ============================================================================

const MEASUREMENT_DISPLAY_ORDER = [
  "height", "bust", "waist", "hips",
  "inseam", "collar", "sleeve", "dress", "shoes",
];

const MEASUREMENT_LABELS = {
  height: "Height",
  bust: "Bust",
  waist: "Waist",
  hips: "Hips",
  inseam: "Inseam",
  collar: "Collar",
  sleeve: "Sleeve",
  dress: "Dress",
  shoes: "Shoes",
};

function getMeasurementDisplayValue(key, value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function parseMeasurementsForDisplay(measurements) {
  if (!measurements || typeof measurements !== "object") return [];

  const entries = [];
  const seen = new Set();

  for (const key of MEASUREMENT_DISPLAY_ORDER) {
    if (Object.prototype.hasOwnProperty.call(measurements, key)) {
      const value = getMeasurementDisplayValue(key, measurements[key]);
      if (value) {
        entries.push({ key, label: MEASUREMENT_LABELS[key] || key, value });
        seen.add(key);
      }
    }
  }

  for (const [key, rawValue] of Object.entries(measurements)) {
    if (seen.has(key)) continue;
    const value = getMeasurementDisplayValue(key, rawValue);
    if (value) {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      entries.push({ key, label, value });
    }
  }

  return entries;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function buildDisplayName(profile) {
  if (profile.name && profile.name.trim()) {
    return profile.name.trim();
  }
  const first = (profile.firstName || "").trim();
  const last = (profile.lastName || "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || "Unnamed";
}

// ============================================================================
// COMPLETENESS HEURISTIC
// ============================================================================

/**
 * Compute profile completeness for the summary band.
 * Returns { filled, total } for display as "X/Y"
 */
function computeCompleteness(profile, type) {
  const isTalent = type === "talent";

  if (isTalent) {
    // Talent fields: name, gender, agency, portfolioUrl, email, phone, notes, headshot, + measurements
    const fields = [
      Boolean(profile.name || profile.firstName || profile.lastName),
      Boolean(profile.gender),
      Boolean(profile.agency),
      Boolean(profile.url),
      Boolean(profile.email),
      Boolean(profile.phone),
      Boolean(profile.notes || profile.sizing),
      Boolean(profile.headshotPath),
    ];

    // Measurements: count as filled if any measurement exists
    const hasMeasurements = profile.measurements &&
      typeof profile.measurements === "object" &&
      Object.values(profile.measurements).some((v) => v !== null && v !== undefined && v !== "");

    fields.push(hasMeasurements);

    const filled = fields.filter(Boolean).length;
    return { filled, total: fields.length };
  } else {
    // Crew fields: name, company, email, phone, department, position, notes
    const fields = [
      Boolean(profile.name || profile.firstName || profile.lastName),
      Boolean(profile.company),
      Boolean(profile.email),
      Boolean(profile.phone),
      Boolean(profile.departmentId),
      Boolean(profile.positionId),
      Boolean(profile.notes),
    ];

    const filled = fields.filter(Boolean).length;
    return { filled, total: fields.length };
  }
}

/**
 * Format timestamp for display
 */
function formatLastUpdated(timestamp) {
  if (!timestamp) return "—";

  // Handle Firestore Timestamp
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return "—";

  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ============================================================================
// SUMMARY METRICS BAND
// ============================================================================

function MetricSlot({ icon: Icon, label, value, variant = "default" }) {
  const variantStyles = {
    default: "text-slate-600 dark:text-slate-300",
    muted: "text-slate-400 dark:text-slate-500",
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Icon className={`w-4 h-4 flex-shrink-0 ${variantStyles[variant]} opacity-60`} />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <p className={`text-sm font-semibold truncate ${variantStyles[variant]}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function SummaryBand({ profile, type }) {
  const completeness = useMemo(
    () => computeCompleteness(profile, type),
    [profile, type]
  );

  const lastUpdated = formatLastUpdated(profile.updatedAt || profile.createdAt);

  return (
    <div className="flex items-center divide-x divide-slate-100 dark:divide-slate-700 border border-slate-100 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
      <MetricSlot
        icon={CheckCircle2}
        label="Completeness"
        value={`${completeness.filled}/${completeness.total}`}
      />
      <MetricSlot
        icon={Clock}
        label="Last updated"
        value={lastUpdated}
      />
      <MetricSlot
        icon={Link2}
        label="Used in"
        value="—"
        variant="muted"
      />
    </div>
  );
}

// ============================================================================
// DESIGNED EMPTY STATES
// ============================================================================

function TabEmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="py-8 px-4">
      <div className="flex items-start gap-4 max-w-md">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center">
          <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
        </div>
        <div className="pt-0.5">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            {description}
          </p>
          {actionLabel && (
            <button
              type="button"
              onClick={onAction}
              disabled={!onAction}
              className={`
                mt-3 text-xs font-medium
                ${onAction
                  ? "text-primary hover:text-primary/80 dark:text-primary-400"
                  : "text-slate-400 dark:text-slate-500 cursor-default"
                }
              `}
            >
              {actionLabel} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FACT ROW (for Overview tab)
// ============================================================================

function FactRow({ label, value, href, isEditable, onSave, placeholder, type = "text" }) {
  const isEmpty = !value || !value.trim();

  // Editable version
  if (isEditable && onSave) {
    return (
      <div className="py-2">
        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
          {label}
        </p>
        <InlineEditField
          value={value || ""}
          onSave={onSave}
          placeholder={placeholder || `Add ${label.toLowerCase()}`}
          type={type}
          className="text-sm"
        />
      </div>
    );
  }

  // Read-only version
  return (
    <div className="py-2">
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      {isEmpty ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 italic">—</p>
      ) : href ? (
        <a
          href={href}
          target={type === "url" ? "_blank" : undefined}
          rel={type === "url" ? "noopener noreferrer" : undefined}
          className="text-sm text-primary hover:underline break-all"
        >
          {value}
        </a>
      ) : (
        <p className="text-sm text-slate-900 dark:text-slate-100">{value}</p>
      )}
    </div>
  );
}

// ============================================================================
// TAB CONTENT COMPONENTS
// ============================================================================

/**
 * Overview Tab — Contact info in 2-column grid
 */
function OverviewTab({ profile, type, canEdit, onFieldSave }) {
  const isTalent = type === "talent";

  return (
    <div className="p-5">
      <div className="grid grid-cols-2 gap-x-8 gap-y-1">
        {/* Gender (talent only) */}
        {isTalent && (
          <FactRow
            label="Gender"
            value={profile.gender || ""}
            isEditable={canEdit}
            onSave={(val) => onFieldSave("gender", val)}
            placeholder="Add gender"
          />
        )}

        {/* Portfolio (talent only) */}
        {isTalent && (
          <FactRow
            label="Portfolio"
            value={profile.url || ""}
            href={profile.url}
            isEditable={canEdit}
            onSave={(val) => onFieldSave("url", val)}
            placeholder="Add portfolio URL"
            type="url"
          />
        )}

        {/* Company (crew only) */}
        {!isTalent && (
          <FactRow
            label="Company"
            value={profile.company || ""}
            isEditable={canEdit}
            onSave={(val) => onFieldSave("company", val)}
            placeholder="Add company"
          />
        )}

        {/* Email */}
        <FactRow
          label="Email"
          value={profile.email || ""}
          href={profile.email ? `mailto:${profile.email}` : null}
          isEditable={canEdit}
          onSave={(val) => onFieldSave("email", val)}
          placeholder="Add email"
          type="email"
        />

        {/* Phone */}
        <FactRow
          label="Phone"
          value={profile.phone || ""}
          isEditable={canEdit}
          onSave={(val) => onFieldSave("phone", val)}
          placeholder="Add phone"
          type="tel"
        />
      </div>
    </div>
  );
}

/**
 * Measurements Tab — Talent only
 */
function MeasurementsTab({ profile, canEdit }) {
  const measurementEntries = useMemo(
    () => parseMeasurementsForDisplay(profile.measurements),
    [profile.measurements]
  );

  const hasMeasurements = measurementEntries.length > 0;

  if (!hasMeasurements) {
    return (
      <TabEmptyState
        icon={Ruler}
        title="No measurements yet"
        description="Add baseline measurements to enable filtering and casting queries."
        actionLabel={canEdit ? "Add measurements" : null}
      />
    );
  }

  return (
    <div className="p-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
        {measurementEntries.map(({ key, label, value }) => (
          <div key={key} className="flex items-baseline justify-between">
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {label}
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Gallery Tab — Talent only
 */
function GalleryTab({ canEdit }) {
  // Gallery data not yet wired — show designed empty state
  return (
    <TabEmptyState
      icon={ImageIcon}
      title="No gallery images"
      description="Upload 3–5 selects for quick casting review."
      actionLabel={canEdit ? "Upload images" : null}
    />
  );
}

/**
 * Role Tab — Crew only
 */
function RoleTab({ deptName, positionName, canEdit }) {
  const hasRole = deptName || positionName;

  if (!hasRole) {
    return (
      <TabEmptyState
        icon={Briefcase}
        title="No role assigned"
        description="Assign department + position to power call sheets and crew planning."
        actionLabel={canEdit ? "Assign role" : null}
      />
    );
  }

  return (
    <div className="p-5">
      <div className="flex items-center gap-2 flex-wrap">
        {positionName && (
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
            {positionName}
          </span>
        )}
        {deptName && (
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-50 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400">
            {deptName}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Notes Tab — Both types
 */
function NotesTab({ profile, canEdit, onFieldSave }) {
  const notesContent = profile.notes || profile.sizing || "";
  const notesPlain = stripHtml(notesContent);
  const hasNotes = notesPlain && notesPlain.trim();

  if (!hasNotes && !canEdit) {
    return (
      <TabEmptyState
        icon={FileText}
        title="No notes yet"
        description="Add on-set notes like availability, restrictions, wardrobe, or preferences."
        actionLabel={null}
      />
    );
  }

  return (
    <div className="p-5">
      {canEdit ? (
        <InlineEditField
          value={notesPlain || ""}
          onSave={(val) => onFieldSave("notes", val)}
          placeholder="Add notes about this profile..."
          multiline
          rows={5}
          className="text-sm leading-relaxed"
        />
      ) : (
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap max-w-prose">
          {notesPlain}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// PROFILE CANVAS COMPONENT
// ============================================================================

/**
 * ProfileCanvas
 *
 * @param {Object} props
 * @param {Object} props.profile - Profile data (talent or crew)
 * @param {'talent'|'crew'} props.type - Profile type
 * @param {boolean} [props.canEdit] - Whether editing is allowed
 * @param {function} [props.onUpdate] - Async handler for field updates ({ field, value })
 * @param {function} [props.onClose] - Close handler
 * @param {string} [props.deptName] - Department name (crew)
 * @param {string} [props.positionName] - Position name (crew)
 */
export default function ProfileCanvas({
  profile,
  type,
  canEdit = false,
  onUpdate,
  onClose,
  deptName,
  positionName,
}) {
  const isTalent = type === "talent";
  const name = profile ? buildDisplayName(profile) : "";

  // Active tab state
  const [activeTab, setActiveTab] = useState("overview");

  // Field update handler
  const handleFieldSave = useCallback(async (field, value) => {
    if (!onUpdate) return;
    await onUpdate({ field, value });
  }, [onUpdate]);

  // ══════════════════════════════════════════════════════════════════════════
  // EMPTY STATE (no profile selected)
  // ══════════════════════════════════════════════════════════════════════════

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          </div>
          <h2 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">
            Select a profile
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            Choose someone from the list to view their details.
          </p>
        </div>
      </div>
    );
  }

  // Check if we're in workspace mode (no close button)
  const isWorkspaceMode = !onClose;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className={`
      flex-1 flex flex-col overflow-hidden
      ${isWorkspaceMode
        ? "bg-slate-50 dark:bg-slate-900"
        : "bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700"
      }
    `}>
      {/* Header - only show close button and header bar if not workspace mode */}
      {!isWorkspaceMode && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className={`
              px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide
              ${isTalent
                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
              }
            `}>
              {isTalent ? "Talent" : "Crew"}
            </span>
            {!canEdit && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                View only
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto">
        <div className={`
          max-w-2xl mx-auto px-6
          ${isWorkspaceMode ? "py-8" : "py-6"}
        `}>
          {/* ════════════════════════════════════════════════════════════════
              WORKSPACE STAGE CONTAINER
              ════════════════════════════════════════════════════════════════ */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">

            {/* ══════════════════════════════════════════════════════════════
                HERO / IDENTITY BLOCK
                ══════════════════════════════════════════════════════════════ */}
            <div className="p-6 pb-4">
              {/* Type badge + View only indicator */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className={`
                  px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide
                  ${isTalent
                    ? "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400"
                    : "bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400"
                  }
                `}>
                  {isTalent ? "Talent" : "Crew"}
                </span>
                {!canEdit && isWorkspaceMode && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    View only
                  </span>
                )}
              </div>

              {/* Hero image */}
              <div className="flex justify-center mb-5">
                <div className={`
                  relative overflow-hidden bg-slate-100 dark:bg-slate-700
                  ${isTalent
                    ? "w-36 h-44 rounded-2xl shadow-sm"
                    : "w-20 h-20 rounded-full"
                  }
                `}>
                  {isTalent ? (
                    <Thumb
                      path={profile.headshotPath || null}
                      size={400}
                      alt={name}
                      className="w-full h-full"
                      imageClassName="w-full h-full object-cover object-top"
                      fallback={
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
                          <Users className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                        </div>
                      }
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
                      <User className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                    </div>
                  )}
                </div>
              </div>

              {/* Name — hero typographic anchor */}
              <div className="text-center mb-1">
                {canEdit && onUpdate ? (
                  <InlineEditField
                    value={name}
                    onSave={(val) => handleFieldSave("name", val)}
                    placeholder="Enter name"
                    className="text-xl font-semibold text-slate-900 dark:text-slate-100 justify-center"
                    inputClassName="text-xl font-semibold text-center"
                  />
                ) : (
                  <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {name}
                  </h1>
                )}
              </div>

              {/* Secondary identity line */}
              <div className="text-center mb-6">
                {isTalent ? (
                  canEdit && onUpdate ? (
                    <InlineEditField
                      value={profile.agency || ""}
                      onSave={(val) => handleFieldSave("agency", val)}
                      placeholder="Add agency"
                      className="text-sm text-slate-500 dark:text-slate-400 justify-center"
                      inputClassName="text-center"
                    />
                  ) : (
                    profile.agency && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {profile.agency}
                      </p>
                    )
                  )
                ) : (
                  // For crew, show position/dept if available, otherwise company
                  (positionName || deptName) ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {[positionName, deptName].filter(Boolean).join(" · ")}
                    </p>
                  ) : canEdit && onUpdate ? (
                    <InlineEditField
                      value={profile.company || ""}
                      onSave={(val) => handleFieldSave("company", val)}
                      placeholder="Add company"
                      className="text-sm text-slate-500 dark:text-slate-400 justify-center"
                      inputClassName="text-center"
                    />
                  ) : (
                    profile.company && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {profile.company}
                      </p>
                    )
                  )
                )}
              </div>

              {/* ══════════════════════════════════════════════════════════════
                  SUMMARY METRICS BAND
                  ══════════════════════════════════════════════════════════════ */}
              <SummaryBand profile={profile} type={type} />
            </div>

            {/* ══════════════════════════════════════════════════════════════
                INNER TABS
                ══════════════════════════════════════════════════════════════ */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Tab list */}
              <div className="px-5 border-t border-slate-100 dark:border-slate-700">
                <TabsList className="w-full justify-start -mb-px bg-transparent p-0 h-auto gap-0">
                  <TabsTrigger
                    value="overview"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-slate-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-xs font-medium"
                  >
                    Overview
                  </TabsTrigger>

                  {isTalent ? (
                    <>
                      <TabsTrigger
                        value="measurements"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-slate-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-xs font-medium"
                      >
                        Measurements
                      </TabsTrigger>
                      <TabsTrigger
                        value="gallery"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-slate-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-xs font-medium"
                      >
                        Gallery
                      </TabsTrigger>
                    </>
                  ) : (
                    <TabsTrigger
                      value="role"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-slate-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-xs font-medium"
                    >
                      Role
                    </TabsTrigger>
                  )}

                  <TabsTrigger
                    value="notes"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-slate-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-xs font-medium"
                  >
                    Notes
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab content */}
              <div className="border-t border-slate-100 dark:border-slate-700">
                <TabsContent value="overview" className="mt-0">
                  <OverviewTab
                    profile={profile}
                    type={type}
                    canEdit={canEdit}
                    onFieldSave={handleFieldSave}
                  />
                </TabsContent>

                {isTalent ? (
                  <>
                    <TabsContent value="measurements" className="mt-0">
                      <MeasurementsTab profile={profile} canEdit={canEdit} />
                    </TabsContent>
                    <TabsContent value="gallery" className="mt-0">
                      <GalleryTab canEdit={canEdit} />
                    </TabsContent>
                  </>
                ) : (
                  <TabsContent value="role" className="mt-0">
                    <RoleTab
                      deptName={deptName}
                      positionName={positionName}
                      canEdit={canEdit}
                    />
                  </TabsContent>
                )}

                <TabsContent value="notes" className="mt-0">
                  <NotesTab
                    profile={profile}
                    canEdit={canEdit}
                    onFieldSave={handleFieldSave}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
