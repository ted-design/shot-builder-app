/**
 * ProfileCard — Discovery card for unified Profiles surface (R.4)
 *
 * DESIGN PHILOSOPHY:
 * - Discovery surface card, NOT editing
 * - Talent: Image-forward, rectangular portrait, measurements/agency emphasis
 * - Crew: Role-forward, circular avatar, department/company emphasis
 * - Visual distinction without separate code paths where possible
 */

import { User, Users, Briefcase, Building2 } from "lucide-react";
import Thumb from "../Thumb";

/**
 * Build display name from profile fields
 */
function buildDisplayName(profile) {
  if (profile.name && profile.name.trim()) {
    return profile.name.trim();
  }
  const first = (profile.firstName || "").trim();
  const last = (profile.lastName || "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || "Unnamed";
}

/**
 * Get subtitle based on profile type
 */
function getSubtitle(profile, type, deptName, positionName) {
  if (type === "talent") {
    return profile.agency || null;
  }
  // Crew: position > department > company
  const parts = [positionName, deptName].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  return profile.company || null;
}

/**
 * ProfileCard
 *
 * @param {Object} props
 * @param {Object} props.profile - Profile data (talent or crew)
 * @param {'talent'|'crew'} props.type - Profile type
 * @param {boolean} [props.isSelected] - Whether this card is selected
 * @param {function} props.onClick - Click handler
 * @param {string} [props.deptName] - Department name (crew)
 * @param {string} [props.positionName] - Position name (crew)
 */
export default function ProfileCard({
  profile,
  type,
  isSelected = false,
  onClick,
  deptName,
  positionName,
}) {
  const name = buildDisplayName(profile);
  const subtitle = getSubtitle(profile, type, deptName, positionName);
  const isTalent = type === "talent";

  // Type indicator
  const TypeIcon = isTalent ? Users : User;
  const typeLabel = isTalent ? "Talent" : "Crew";
  const typeColor = isTalent
    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
    : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group relative w-full text-left rounded-xl overflow-hidden
        transition-all duration-200 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        ${isSelected
          ? "ring-2 ring-primary shadow-lg scale-[1.02]"
          : "hover:shadow-md hover:-translate-y-0.5"
        }
        bg-white dark:bg-slate-800
        border border-slate-200 dark:border-slate-700
      `}
    >
      {/* Image area — different aspect ratios for talent vs crew */}
      <div className={`
        relative overflow-hidden bg-slate-100 dark:bg-slate-700
        ${isTalent ? "aspect-[3/4]" : "aspect-[4/3]"}
      `}>
        {isTalent ? (
          // Talent: Rectangular portrait, object-top for headshots
          <Thumb
            path={profile.headshotPath || null}
            size={400}
            alt={name}
            className="w-full h-full"
            imageClassName="w-full h-full object-cover object-top"
            fallback={
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
                <Users className="w-16 h-16 text-slate-300 dark:text-slate-500" />
              </div>
            }
          />
        ) : (
          // Crew: Centered circular avatar placeholder
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
            <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-600 shadow-inner flex items-center justify-center">
              <User className="w-12 h-12 text-slate-400 dark:text-slate-300" />
            </div>
          </div>
        )}

        {/* Type badge — top right */}
        <div className={`
          absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide
          ${typeColor}
        `}>
          {typeLabel}
        </div>
      </div>

      {/* Content area */}
      <div className="p-3">
        {/* Name */}
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
          {name}
        </h3>

        {/* Subtitle (agency for talent, role for crew) */}
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
            {!isTalent && (deptName || positionName) && (
              <Briefcase className="w-3 h-3 flex-shrink-0" />
            )}
            {isTalent && (
              <Building2 className="w-3 h-3 flex-shrink-0" />
            )}
            <span className="truncate">{subtitle}</span>
          </p>
        )}

        {/* Secondary info */}
        {isTalent && profile.gender && (
          <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
            {profile.gender}
          </p>
        )}
      </div>
    </button>
  );
}
