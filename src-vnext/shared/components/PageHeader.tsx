import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"

interface Breadcrumb {
  readonly label: string
  readonly to?: string
}

interface PageHeaderProps {
  readonly title: string
  readonly actions?: ReactNode
  readonly breadcrumbs?: readonly Breadcrumb[]
}

export function PageHeader({ title, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="pb-4">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 pb-1 text-xs text-[var(--color-text-muted)]">
          {breadcrumbs.map((crumb, idx) => (
            <span key={crumb.label} className="flex items-center gap-1">
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
        <h1 className="text-xl font-semibold text-[var(--color-text)] md:text-2xl">
          {title}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
