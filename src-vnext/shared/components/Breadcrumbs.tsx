import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { useBreadcrumbs } from "@/app/routes/useBreadcrumbs"
import type { BreadcrumbEntry } from "@/app/routes/breadcrumbs"

interface BreadcrumbsProps {
  /**
   * Override the auto-resolved trail. When omitted, reads from
   * breadcrumbsConfig via useBreadcrumbs.
   */
  readonly items?: readonly BreadcrumbEntry[]
  readonly trailingCrumbLabel?: string
  readonly className?: string
}

// Standalone breadcrumb strip for pages that don't render a PageHeader
// (e.g. ShotDetailPage, ExportBuilderPage). Shares the same config +
// resolver as PageHeader's auto-crumb behaviour.
export function Breadcrumbs({
  items,
  trailingCrumbLabel,
  className,
}: BreadcrumbsProps) {
  const autoItems = useBreadcrumbs(trailingCrumbLabel)
  const effectiveItems = items ?? autoItems

  if (effectiveItems.length === 0) return null

  return (
    <nav
      className={
        className ??
        "flex items-center gap-1 text-xs text-[var(--color-text-muted)]"
      }
      aria-label="Breadcrumb"
    >
      {effectiveItems.map((crumb, idx) => (
        <span key={`${crumb.label}-${idx}`} className="flex items-center gap-1">
          {idx > 0 && <ChevronRight className="h-3 w-3" />}
          {crumb.to ? (
            <Link
              to={crumb.to}
              className="hover:text-[var(--color-text)] transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span>{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
