import { useState } from "react"
import { ExternalLink, CheckCircle2, XCircle } from "lucide-react"
import { ShotRequestStatusBadge } from "./ShotRequestStatusBadge"
import { AbsorbDialog } from "./AbsorbDialog"
import { RejectDialog } from "./RejectDialog"
import { formatRelativeTime } from "@/features/requests/lib/formatRelativeTime"
import { Button } from "@/ui/button"
import type { ShotRequest } from "@/shared/types"

interface TriagePanelProps {
  readonly request: ShotRequest
  readonly projectName?: string | null
}

function SectionLabel({ children }: { readonly children: string }) {
  return (
    <h3 className="label-meta mb-1 text-[var(--color-text-muted)]">{children}</h3>
  )
}

export function TriagePanel({ request, projectName }: TriagePanelProps) {
  const [absorbOpen, setAbsorbOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)

  const isUrgent = request.priority === "urgent"
  const canTriage = request.status === "submitted" || request.status === "triaged"
  const isAbsorbed = request.status === "absorbed"
  const isRejected = request.status === "rejected"

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {isUrgent && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-error)]">
                <span className="block h-2 w-2 rounded-full bg-[var(--color-error)]" />
                Urgent
              </span>
            )}
            {!isUrgent && (
              <span className="text-xs text-[var(--color-text-muted)]">Normal</span>
            )}
          </div>
          <h2 className="text-lg font-medium text-[var(--color-text)]">{request.title}</h2>
        </div>
        <ShotRequestStatusBadge status={request.status} />
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        Submitted by {request.submittedByName ?? "Unknown"} · {formatRelativeTime(request.submittedAt)}
      </p>

      {request.description && (
        <div>
          <SectionLabel>Description</SectionLabel>
          <p className="whitespace-pre-wrap text-sm text-[var(--color-text)]">
            {request.description}
          </p>
        </div>
      )}

      {request.referenceUrls && request.referenceUrls.length > 0 && (
        <div>
          <SectionLabel>References</SectionLabel>
          <ul className="flex flex-col gap-1">
            {request.referenceUrls.map((url, index) => (
              <li key={index}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {request.deadline && (
        <div>
          <SectionLabel>Deadline</SectionLabel>
          <p className="text-sm text-[var(--color-text)]">{request.deadline}</p>
        </div>
      )}

      {request.notes && (
        <div>
          <SectionLabel>Notes</SectionLabel>
          <p className="whitespace-pre-wrap text-sm text-[var(--color-text)]">
            {request.notes}
          </p>
        </div>
      )}

      {isAbsorbed && (
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-status-green-border)] bg-[var(--color-status-green-bg)] p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-status-green-text)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-status-green-text)]">
              Absorbed into {projectName ?? "project"}
            </p>
            {request.absorbedAsShotId && (
              <p className="text-xs text-[var(--color-text-muted)]">
                Shot {request.absorbedAsShotId}
              </p>
            )}
          </div>
        </div>
      )}

      {isRejected && (
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
          <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-text-muted)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-text-muted)]">Rejected</p>
            {request.rejectionReason && (
              <p className="text-xs text-[var(--color-text-muted)]">
                {request.rejectionReason}
              </p>
            )}
          </div>
        </div>
      )}

      {canTriage && (
        <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-4">
          <Button
            onClick={() => setAbsorbOpen(true)}
            className="bg-[var(--color-status-green-text)] hover:bg-[var(--color-status-green-text)]/90 text-white"
          >
            Absorb into Project
          </Button>
          <Button
            variant="outline"
            onClick={() => setRejectOpen(true)}
          >
            Reject
          </Button>
        </div>
      )}

      <AbsorbDialog
        open={absorbOpen}
        onOpenChange={setAbsorbOpen}
        request={request}
      />
      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        request={request}
      />
    </div>
  )
}
