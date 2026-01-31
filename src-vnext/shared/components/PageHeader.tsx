import type { ReactNode } from "react"

interface PageHeaderProps {
  readonly title: string
  readonly actions?: ReactNode
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 pb-4">
      <h1 className="text-xl font-semibold text-[var(--color-text)] md:text-2xl">
        {title}
      </h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
