import { sanitizeHtml, isEmptyHtml } from "@/shared/lib/sanitizeHtml"

interface SanitizedHtmlProps {
  readonly html: string | null | undefined
  readonly emptyText?: string
  readonly className?: string
}

/**
 * Renders sanitized HTML content as read-only.
 * Used for legacy rich-text notes that must never be edited in vNext.
 * If content is empty or not a string, shows a placeholder.
 */
export function SanitizedHtml({
  html,
  emptyText = "No legacy notes",
  className,
}: SanitizedHtmlProps) {
  if (isEmptyHtml(html)) {
    return (
      <p className="text-sm italic text-[var(--color-text-subtle)]">
        {emptyText}
      </p>
    )
  }

  const clean = sanitizeHtml(html!)

  return (
    <div
      className={`prose prose-sm max-w-none text-[var(--color-text-secondary)] ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}
