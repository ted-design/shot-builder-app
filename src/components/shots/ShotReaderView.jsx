/**
 * ShotReaderView — Mobile read-only detail surface for a shot.
 *
 * Renders a calm, scrollable overview of shot metadata, notes, and
 * entity counts. No inputs, no editing, no auto-save.
 *
 * Used by ShotEditorPageV3 when the viewport is below the md breakpoint
 * so mobile users see useful shot details instead of a DesktopOnlyGuard
 * dead-end.
 */

import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Monitor,
  MapPin,
  Users,
  Package,
  Tag,
  FileText,
  Hash,
} from "lucide-react";
import { Button } from "../ui/button";
import { normaliseShotStatus, shotStatusOptions } from "../../lib/shotStatus";
import { getShotNotesPreview } from "../../lib/shotNotes";

// ─── Status badge classes (mirrors ShotTableView) ──────────────────────────
const STATUS_LABEL_MAP = new Map(
  shotStatusOptions.map(({ value, label }) => [value, label])
);

const statusBadgeClasses = {
  todo: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  in_progress:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
  complete:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  on_hold:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
};

// ─── Small metadata row ────────────────────────────────────────────────────
function MetadataRow({ icon: Icon, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-xs text-slate-500 dark:text-slate-400 block">
          {label}
        </span>
        <span className="text-sm text-slate-900 dark:text-slate-100">
          {value}
        </span>
      </div>
    </div>
  );
}

// ─── Entity count chip ─────────────────────────────────────────────────────
function CountChip({ icon: Icon, label, count }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 px-3 py-2">
      <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
      <span className="text-sm text-slate-700 dark:text-slate-300">
        {count} {label}
      </span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function ShotReaderView({ shot, counts = {} }) {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const statusValue = normaliseShotStatus(shot?.status);
  const statusLabel = STATUS_LABEL_MAP.get(statusValue) || shot?.status || "To do";
  const statusClass =
    statusBadgeClasses[statusValue] || statusBadgeClasses.todo;

  const notesPreview = getShotNotesPreview(shot);

  // Resolve location name from shot metadata
  const locationName =
    shot?.locationName ||
    (Array.isArray(shot?.locations) && shot.locations[0]?.name) ||
    null;

  const handleBack = () => {
    navigate(`/projects/${projectId}/shots`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-1 -ml-1 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            aria-label="Back to shots"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {shot?.name || "Unnamed shot"}
            </h1>
            {shot?.shotNumber && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                #{shot.shotNumber}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="px-4 py-5 space-y-6">
        {/* Status badge */}
        <div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Shot number (if not already shown in header) */}
        {shot?.shotNumber && (
          <MetadataRow
            icon={Hash}
            label="Shot number"
            value={shot.shotNumber}
          />
        )}

        {/* Description / type */}
        {shot?.description && (
          <MetadataRow
            icon={FileText}
            label="Description"
            value={shot.description}
          />
        )}

        {/* Location */}
        {locationName && (
          <MetadataRow icon={MapPin} label="Location" value={locationName} />
        )}

        {/* Notes preview */}
        {notesPreview && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Notes
            </span>
            <div className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line line-clamp-6">
                {notesPreview}
              </p>
            </div>
          </div>
        )}

        {/* Tags */}
        {Array.isArray(shot?.tags) && shot.tags.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Tags
            </span>
            <div className="flex flex-wrap gap-1.5">
              {shot.tags.map((tag, i) => (
                <span
                  key={typeof tag === "string" ? tag : tag?.id || i}
                  className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {typeof tag === "string" ? tag : tag?.label || tag?.name || "Tag"}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Entity counts */}
        {(counts.talent > 0 || counts.products > 0) && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Assigned
            </span>
            <div className="flex flex-wrap gap-2">
              <CountChip
                icon={Users}
                label={counts.talent === 1 ? "talent" : "talent"}
                count={counts.talent}
              />
              <CountChip
                icon={Package}
                label={counts.products === 1 ? "product" : "products"}
                count={counts.products}
              />
            </div>
          </div>
        )}

        {/* Desktop hint */}
        <div className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2.5 mt-4">
          <Monitor className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Editing available on desktop
          </span>
        </div>
      </div>
    </div>
  );
}
