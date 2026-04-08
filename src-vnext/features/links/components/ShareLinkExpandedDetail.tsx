import type { ShareLink } from "@/features/links/lib/shareLinkTypes"

interface ShareLinkExpandedDetailProps {
  readonly link: ShareLink
}

export function ShareLinkExpandedDetail({ link }: ShareLinkExpandedDetailProps) {
  const { contentItems, contentCount } = link
  const hasItems = contentItems !== null && contentItems.length > 0
  const overflowCount =
    contentCount !== null && contentItems !== null && contentCount > contentItems.length
      ? contentCount - contentItems.length
      : 0

  if (!hasItems && overflowCount === 0) {
    return (
      <tr>
        <td
          colSpan={6}
          className="px-6 py-3 bg-[var(--color-surface-subtle)] border-b border-[var(--color-border)]"
        >
          <p className="text-xs text-[var(--color-text-subtle)]">No content details available.</p>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td
        colSpan={6}
        className="px-6 py-3 bg-[var(--color-surface-subtle)] border-b border-[var(--color-border)]"
      >
        {hasItems && (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
            {contentItems!.map((item, idx) => (
              <li key={idx} className="flex items-baseline gap-1.5 min-w-0">
                <span className="truncate text-xs text-[var(--color-text)]">{item.label}</span>
                {item.sublabel != null && item.sublabel.length > 0 && (
                  <span className="truncate text-2xs text-[var(--color-text-muted)]">
                    {item.sublabel}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {overflowCount > 0 && (
          <p className="mt-1.5 text-2xs text-[var(--color-text-subtle)]">
            and {overflowCount} more
          </p>
        )}
      </td>
    </tr>
  )
}
