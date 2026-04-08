import { Link } from "react-router-dom"
import type { ChangeEvent } from "react"
import type { useSensors } from "@dnd-kit/core"
import { Button } from "@/ui/button"
import { TalentShotHistory } from "@/features/library/components/TalentShotHistory"
import { TalentHeroZone } from "@/features/library/components/TalentHeroZone"
import { TalentContactSection } from "@/features/library/components/TalentContactSection"
import { TalentMeasurementsSection } from "@/features/library/components/TalentMeasurementsSection"
import { TalentNotesSection } from "@/features/library/components/TalentNotesSection"
import { TalentPortfolioSection } from "@/features/library/components/TalentPortfolioSection"
import { CastingSessionList } from "@/features/library/components/CastingSessionList"
import type { TalentRecord } from "@/shared/types"
import type { TalentImage, CastingSession } from "@/features/library/components/talentUtils"

interface TalentDetailPanelProps {
  readonly selected: TalentRecord
  readonly canEdit: boolean
  readonly isMobile: boolean
  readonly busy: boolean
  readonly setBusy: (busy: boolean) => void
  readonly clientId: string | null
  readonly userId: string | null
  readonly activeTab: "detail" | "history"
  readonly setActiveTab: (tab: "detail" | "history") => void
  readonly selectedHeadshotUrl: string | null
  readonly selectedHeadshotPath: string | null
  readonly portfolioImages: TalentImage[]
  readonly castingSessions: CastingSession[]
  readonly projects: Array<{ id: string; name?: string | null }>
  readonly projectLookup: Map<string, string>
  readonly sensors: ReturnType<typeof useSensors>
  readonly savePatch: (id: string, patch: Record<string, unknown>) => Promise<void>
  readonly updateGallery: (
    next: TalentImage[],
    removedPaths?: readonly (string | null | undefined)[],
    successLabel?: string,
  ) => Promise<void>
  readonly updateCastingSessions: (
    next: CastingSession[],
    removedPaths?: readonly (string | null | undefined)[],
    successLabel?: string,
  ) => Promise<void>
  readonly onHeadshotFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  readonly onPortfolioFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  readonly onCastingFiles: (sessionId: string, event: ChangeEvent<HTMLInputElement>) => Promise<void>
  readonly setHeadshotRemoveOpen: (open: boolean) => void
  readonly setGalleryRemoveOpen: (open: boolean) => void
  readonly setGalleryRemoveTarget: (target: TalentImage | null) => void
  readonly setSessionRemoveOpen: (open: boolean) => void
  readonly setSessionRemoveTarget: (target: CastingSession | null) => void
  readonly sessionExpanded: Record<string, boolean>
  readonly setSessionExpanded: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void
  readonly setDeleteOpen: (open: boolean) => void
  readonly setCreateSessionOpen: (open: boolean) => void
  readonly setPrintSessionId: (id: string | null) => void
}

export function TalentDetailPanel({
  selected,
  canEdit,
  isMobile,
  busy,
  setBusy: _setBusy,
  clientId,
  userId: _userId,
  activeTab,
  setActiveTab,
  selectedHeadshotUrl,
  selectedHeadshotPath,
  portfolioImages,
  castingSessions,
  projects,
  projectLookup,
  sensors,
  savePatch,
  updateGallery,
  updateCastingSessions,
  onHeadshotFile,
  onPortfolioFiles,
  onCastingFiles,
  setHeadshotRemoveOpen,
  setGalleryRemoveOpen,
  setGalleryRemoveTarget,
  setSessionRemoveOpen,
  setSessionRemoveTarget,
  sessionExpanded,
  setSessionExpanded,
  setDeleteOpen,
  setCreateSessionOpen,
  setPrintSessionId,
}: TalentDetailPanelProps) {
  return (
    <div className="flex flex-col">
      {/* Hero zone: headshot + name + agency + gender */}
      <TalentHeroZone
        selected={selected}
        canEdit={canEdit}
        busy={busy}
        selectedHeadshotUrl={selectedHeadshotUrl}
        selectedHeadshotPath={selectedHeadshotPath}
        savePatch={savePatch}
        onHeadshotFile={onHeadshotFile}
        setHeadshotRemoveOpen={setHeadshotRemoveOpen}
      />

      {/* Tab bar */}
      <div
        role="tablist"
        className="flex gap-0 overflow-x-auto border-b border-[var(--color-border)] px-5"
      >
        {(
          [
            { key: "detail" as const, label: "Profile" },
            { key: "history" as const, label: "Shot History" },
          ] as const
        ).map((tab, idx, arr) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            tabIndex={activeTab === tab.key ? 0 : -1}
            onClick={() => setActiveTab(tab.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault()
                const next = arr[(idx + 1) % arr.length]!
                setActiveTab(next.key)
                ;(e.currentTarget.parentElement?.querySelector(
                  `[aria-selected="true"]`,
                ) as HTMLElement | null)?.focus()
              } else if (e.key === "ArrowLeft") {
                e.preventDefault()
                const prev = arr[(idx - 1 + arr.length) % arr.length]!
                setActiveTab(prev.key)
                ;(e.currentTarget.parentElement?.querySelector(
                  `[aria-selected="true"]`,
                ) as HTMLElement | null)?.focus()
              }
            }}
            className={`-mb-px whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-[var(--color-primary)] text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Shot History tab */}
      {activeTab === "history" && clientId ? (
        <div className="p-5">
          <TalentShotHistory talentId={selected.id} clientId={clientId} />
        </div>
      ) : null}

      {/* Profile tab */}
      {activeTab === "detail" ? (
        <div className="flex flex-col gap-5 p-5">
          <TalentContactSection
            selected={selected}
            canEdit={canEdit}
            busy={busy}
            savePatch={savePatch}
          />

          <TalentMeasurementsSection
            selected={selected}
            canEdit={canEdit}
            busy={busy}
            savePatch={savePatch}
          />

          <TalentNotesSection
            selected={selected}
            canEdit={canEdit}
            busy={busy}
            savePatch={savePatch}
          />

          {/* Projects */}
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="heading-subsection mb-3">Projects</div>
            {(selected.projectIds ?? []).length === 0 ? (
              <div className="text-sm text-[var(--color-text-muted)]">
                Not linked to any projects.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(selected.projectIds ?? []).map((pid) => {
                  const projectName = projectLookup.get(pid) ?? pid
                  return (
                    <Link
                      key={pid}
                      to={`/projects/${pid}/assets`}
                      className="inline-block max-w-[220px] truncate rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-1 text-xs text-[var(--color-text)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]"
                      title={projectName}
                    >
                      {projectName}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          <TalentPortfolioSection
            canEdit={canEdit}
            busy={busy}
            portfolioImages={portfolioImages}
            sensors={sensors}
            updateGallery={updateGallery}
            onPortfolioFiles={onPortfolioFiles}
            setGalleryRemoveOpen={setGalleryRemoveOpen}
            setGalleryRemoveTarget={setGalleryRemoveTarget}
          />

          <CastingSessionList
            castingSessions={castingSessions}
            canEdit={canEdit}
            isMobile={isMobile}
            busy={busy}
            projects={projects}
            sensors={sensors}
            sessionExpanded={sessionExpanded}
            setSessionExpanded={setSessionExpanded}
            updateCastingSessions={updateCastingSessions}
            onCastingFiles={onCastingFiles}
            setGalleryRemoveOpen={setGalleryRemoveOpen}
            setGalleryRemoveTarget={setGalleryRemoveTarget}
            setSessionRemoveOpen={setSessionRemoveOpen}
            setSessionRemoveTarget={setSessionRemoveTarget}
            setCreateSessionOpen={setCreateSessionOpen}
            setPrintSessionId={setPrintSessionId}
          />

          {/* Delete zone */}
          {canEdit ? (
            <div className="mt-2 border-t border-[var(--color-border)] pt-4">
              <Button
                variant="ghost"
                className="text-[var(--color-error)] hover:text-[var(--color-error)]"
                disabled={busy}
                onClick={() => setDeleteOpen(true)}
              >
                Delete talent
              </Button>
              <p className="caption mt-1 text-[var(--color-text-subtle)]">
                Permanently removes this profile.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
