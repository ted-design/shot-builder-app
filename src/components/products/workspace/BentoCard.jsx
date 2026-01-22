/**
 * BentoCard - Clickable overview card for product workspace dashboard
 *
 * Design inspired by kobolabs.io: subtle backgrounds, icon + title + description,
 * with metrics and sub-metrics pills. Cards navigate to workspace sections.
 *
 * Props:
 * - icon: Lucide icon component
 * - title: Section name
 * - description: Brief description of what the section contains
 * - metric: Primary stat (e.g., "8" for sample count)
 * - metricLabel: Label for primary stat (e.g., "total")
 * - subMetrics: Array of { label, value, variant } for sub-metric pills
 * - onClick: Handler for card click
 * - variant: "default" | "coming-soon" (grayed out)
 */

import { ArrowRight } from "lucide-react";

// Sub-metric pill variants
const SUB_METRIC_VARIANTS = {
  default: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  danger: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
};

function SubMetricPill({ label, value, variant = "default" }) {
  const variantClass = SUB_METRIC_VARIANTS[variant] || SUB_METRIC_VARIANTS.default;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${variantClass}`}>
      <span className="font-semibold">{value}</span>
      <span className="opacity-75">{label}</span>
    </span>
  );
}

export default function BentoCard({
  icon: Icon,
  title,
  description,
  metric,
  metricLabel,
  subMetrics = [],
  onClick,
  variant = "default",
}) {
  const isComingSoon = variant === "coming-soon";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isComingSoon}
      className={`
        group relative w-full text-left rounded-xl p-5
        transition-all duration-200 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2
        ${isComingSoon
          ? "bg-slate-50/50 dark:bg-slate-800/30 cursor-not-allowed opacity-60"
          : "bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 hover:shadow-md hover:-translate-y-0.5"
        }
      `}
    >
      {/* Icon */}
      <div
        className={`
          w-10 h-10 rounded-lg flex items-center justify-center mb-4
          ${isComingSoon
            ? "bg-slate-100 dark:bg-slate-700"
            : "bg-white dark:bg-slate-700 shadow-sm group-hover:shadow"
          }
        `}
      >
        <Icon
          className={`w-5 h-5 ${
            isComingSoon
              ? "text-slate-400 dark:text-slate-500"
              : "text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100"
          }`}
        />
      </div>

      {/* Title */}
      <h3
        className={`text-sm font-semibold mb-1 ${
          isComingSoon
            ? "text-slate-400 dark:text-slate-500"
            : "text-slate-900 dark:text-slate-100"
        }`}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className={`text-xs leading-relaxed mb-4 ${
          isComingSoon
            ? "text-slate-400 dark:text-slate-500"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {description}
      </p>

      {/* Metric area */}
      {!isComingSoon && metric !== undefined && (
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {metric}
              </span>
              {metricLabel && (
                <span className="text-xs text-slate-500 dark:text-slate-400">{metricLabel}</span>
              )}
            </div>

            {/* Sub-metrics */}
            {subMetrics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {subMetrics.map((sm, idx) => (
                  <SubMetricPill key={idx} {...sm} />
                ))}
              </div>
            )}
          </div>

          {/* Arrow indicator on hover */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
        </div>
      )}

      {/* Coming soon badge */}
      {isComingSoon && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-500 dark:bg-slate-600 dark:text-slate-400">
          Coming soon
        </span>
      )}
    </button>
  );
}

export { SubMetricPill };
