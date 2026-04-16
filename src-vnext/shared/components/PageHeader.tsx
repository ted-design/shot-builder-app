import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { useBreadcrumbs } from "@/app/routes/useBreadcrumbs"
import type { BreadcrumbEntry } from "@/app/routes/breadcrumbs"

interface PageHeaderProps {
  readonly title: ReactNode
  readonly actions?: ReactNode
  /**
   * Override the auto-resolved breadcrumb trail. When omitted, PageHeader
   * looks up the current route in breadcrumbsConfig and renders that trail
   * automatically — Phase 0.3 unification. Pass an explicit array to
   * short-circuit the lookup (rarely needed).
   */
  readonly breadcrumbs?: readonly BreadcrumbEntry[]
  /**
   * Dynamic label for the trailing crumb on detail routes
   * (e.g. "Shot #47", a product styleName). Ignored when `breadcrumbs`
   * is passed explicitly or when the route's config resolver does not
   * consume it.
   */
  readonly trailingCrumbLabel?: string
}

export function PageHeader({
  title,
  actions,
  breadcrumbs,
  trailingCrumbLabel,
}: PageHeaderProps) {
  const autoCrumbs = useBreadcrumbs(trailingCrumbLabel)
  const effectiveCrumbs = breadcrumbs ?? autoCrumbs

  return (
    <div className="pb-4">
      {effectiveCrumbs.length > 0 && (
        <nav className="flex items-center gap-1 pb-1 text-xs text-[var(--color-text-muted)]">
          {effectiveCrumbs.map((crumb, idx) => (
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
      )}
      <div className="flex items-center justify-between gap-4">
        <h1 className="heading-page">
          {title}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
