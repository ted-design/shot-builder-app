/**
 * ProfileCanvas — Focused profile detail/editor canvas (R.4 → R.5)
 *
 * DESIGN PHILOSOPHY (from R.1/R.3, refined in R.5):
 * - Inline editing is canonical — click field to edit, blur/Enter to save
 * - Talent: Image-forward, measurements grid, agency/portfolio
 * - Crew: Role-forward, department, company
 * - NO modal for editing existing fields (only create/media)
 *
 * R.5 REFINEMENTS:
 * - Works in workspace mode (no close button when onClose is null)
 * - Better section rhythm and visual hierarchy
 * - Calmer spacing, less boxiness
 *
 * LAYOUT:
 * - Hero portrait section (centered)
 * - Name + subtitle (inline editable)
 * - Organized field sections with clear groupings
 * - Notes section at bottom
 */

import { useCallback, useMemo } from "react";
import {
  User,
  Users,
  Mail,
  Phone,
  Building2,
  ExternalLink,
  Ruler,
  FileText,
  Briefcase,
  X,
} from "lucide-react";
import Thumb from "../Thumb";
import InlineEditField from "./InlineEditField";
import { stripHtml } from "../../lib/stripHtml";

// ============================================================================
// MEASUREMENTS DISPLAY HELPERS (from LibraryTalentPage)
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
  const name = buildDisplayName(profile);

  // Notes handling
  const notesContent = profile.notes || profile.sizing || "";
  const notesPlain = stripHtml(notesContent);

  // Measurements for talent
  const measurementEntries = useMemo(() => {
    if (!isTalent) return [];
    return parseMeasurementsForDisplay(profile.measurements);
  }, [isTalent, profile.measurements]);

  const hasMeasurements = measurementEntries.length > 0;

  // Field update handler
  const handleFieldSave = useCallback(async (field, value) => {
    if (!onUpdate) return;
    await onUpdate({ field, value });
  }, [onUpdate]);

  // ══════════════════════════════════════════════════════════════════════════
  // EMPTY STATE
  // ══════════════════════════════════════════════════════════════════════════

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700">
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-slate-300 dark:text-slate-500" />
          </div>
          <h2 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
            Select a profile
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Choose a profile from the grid to view and edit their details.
          </p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  // Check if we're in workspace mode (no close button)
  const isWorkspaceMode = !onClose;

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
          max-w-xl mx-auto px-8
          ${isWorkspaceMode ? "py-10" : "py-8"}
        `}>
          {/* Hero section with image */}
          <div className="flex flex-col items-center mb-8">
            {/* Hero image */}
            <div className={`
              relative overflow-hidden bg-slate-200 dark:bg-slate-700 shadow-sm
              ${isTalent
                ? "w-36 h-48 rounded-xl"
                : "w-28 h-28 rounded-full"
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
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                    </div>
                  }
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                </div>
              )}
            </div>

            {/* Type badge (shown in workspace mode since there's no header) */}
            {isWorkspaceMode && (
              <div className="mt-4 flex items-center gap-2">
                <span className={`
                  px-2.5 py-1 rounded-full text-xs font-medium
                  ${isTalent
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                    : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                  }
                `}>
                  {isTalent ? "Talent" : "Crew"}
                </span>
                {!canEdit && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    View only
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Name — inline editable */}
          <div className="text-center mb-1">
            {canEdit && onUpdate ? (
              <InlineEditField
                value={name}
                onSave={(val) => handleFieldSave("name", val)}
                placeholder="Enter name"
                className="text-2xl font-semibold text-slate-900 dark:text-slate-100 justify-center"
                inputClassName="text-2xl font-semibold text-center"
              />
            ) : (
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {name}
              </h1>
            )}
          </div>

          {/* Subtitle (agency for talent, role for crew) */}
          <div className="text-center mb-8">
            {isTalent ? (
              canEdit && onUpdate ? (
                <InlineEditField
                  value={profile.agency || ""}
                  onSave={(val) => handleFieldSave("agency", val)}
                  placeholder="Add agency"
                  className="text-base text-slate-500 dark:text-slate-400 justify-center"
                  inputClassName="text-center"
                />
              ) : (
                profile.agency && (
                  <p className="text-base text-slate-500 dark:text-slate-400">
                    {profile.agency}
                  </p>
                )
              )
            ) : (
              (deptName || positionName) && (
                <p className="text-base text-slate-500 dark:text-slate-400">
                  {[positionName, deptName].filter(Boolean).join(" · ")}
                </p>
              )
            )}
          </div>

          {/* Details section - wrapped in card for workspace mode */}
          <div className={`
            space-y-5
            ${isWorkspaceMode
              ? "bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200/60 dark:border-slate-700/60"
              : ""
            }
          `}>
            {/* Gender (talent only) */}
            {isTalent && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                    Gender
                  </p>
                  {canEdit && onUpdate ? (
                    <InlineEditField
                      value={profile.gender || ""}
                      onSave={(val) => handleFieldSave("gender", val)}
                      placeholder="Not specified"
                    />
                  ) : (
                    <p className="text-base text-slate-900 dark:text-slate-100">
                      {profile.gender || "Not specified"}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Company (crew only) */}
            {!isTalent && (
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                    Company
                  </p>
                  {canEdit && onUpdate ? (
                    <InlineEditField
                      value={profile.company || ""}
                      onSave={(val) => handleFieldSave("company", val)}
                      placeholder="Add company"
                    />
                  ) : (
                    <p className="text-base text-slate-900 dark:text-slate-100">
                      {profile.company || "Not specified"}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Department (crew only, read-only — edit via dropdown would need modal) */}
            {!isTalent && deptName && (
              <div className="flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                    Department
                  </p>
                  <p className="text-base text-slate-900 dark:text-slate-100">
                    {deptName}
                    {positionName && (
                      <span className="text-slate-500 dark:text-slate-400"> — {positionName}</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Email */}
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Email
                </p>
                {canEdit && onUpdate ? (
                  <InlineEditField
                    value={profile.email || ""}
                    onSave={(val) => handleFieldSave("email", val)}
                    placeholder="Add email"
                    type="email"
                  />
                ) : profile.email ? (
                  <a
                    href={`mailto:${profile.email}`}
                    className="text-base text-primary hover:underline"
                  >
                    {profile.email}
                  </a>
                ) : (
                  <p className="text-base text-slate-400 dark:text-slate-500 italic">
                    Not provided
                  </p>
                )}
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Phone
                </p>
                {canEdit && onUpdate ? (
                  <InlineEditField
                    value={profile.phone || ""}
                    onSave={(val) => handleFieldSave("phone", val)}
                    placeholder="Add phone"
                    type="tel"
                  />
                ) : (
                  <p className="text-base text-slate-900 dark:text-slate-100">
                    {profile.phone || <span className="text-slate-400 dark:text-slate-500 italic">Not provided</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Portfolio URL (talent only) */}
            {isTalent && (
              <div className="flex items-start gap-3">
                <ExternalLink className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                    Portfolio
                  </p>
                  {canEdit && onUpdate ? (
                    <InlineEditField
                      value={profile.url || ""}
                      onSave={(val) => handleFieldSave("url", val)}
                      placeholder="Add portfolio URL"
                      type="url"
                    />
                  ) : profile.url ? (
                    <a
                      href={profile.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base text-primary hover:underline break-all"
                    >
                      {profile.url}
                    </a>
                  ) : (
                    <p className="text-base text-slate-400 dark:text-slate-500 italic">
                      Not provided
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Measurements grid (talent only) */}
            {isTalent && hasMeasurements && (
              <div className="flex items-start gap-3">
                <Ruler className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    Measurements
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                    {measurementEntries.map(({ key, label, value }) => (
                      <div key={key} className="flex justify-between gap-2">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {label}
                        </span>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Notes
                </p>
                {canEdit && onUpdate ? (
                  <InlineEditField
                    value={notesPlain || ""}
                    onSave={(val) => handleFieldSave("notes", val)}
                    placeholder="Add notes"
                    multiline
                    rows={4}
                  />
                ) : notesPlain ? (
                  <p className="text-base text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {notesPlain}
                  </p>
                ) : (
                  <p className="text-base text-slate-400 dark:text-slate-500 italic">
                    No notes
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
