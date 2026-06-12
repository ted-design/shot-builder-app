// Review shell — the read-only approval surface (Phase 5f, spec §PR partition 5f-II).
//
// Mounted by ShotDetailPageUnified INSTEAD of the editor body when
// `featureReviewSurface` is ON and the resolved surface is a review variant
// (5f-II: 'review-client'; 5f-III: 'review-warehouse'). Surface-keyed, not
// device-keyed (Shoot-shell precedent). This is a PRESENTATION choice, not a
// permission boundary (spec §Rules-vs-UI): the read-only blocks here are
// layout, not enforcement — the firestore rules already gate every write.
//
// ONE component, two variants (`variant` prop). 5f-II implements ONLY
// 'review-client'; 'review-warehouse' renders a minimal placeholder until
// 5f-III fills it (never crashes).
//
// review-client composition (the client's job is to DECIDE / APPROVE):
//   large hero / reference image (read-only, canUpload=false) → shot # /
//   title / read-only status badge → comment composer OPEN (Q4: clients can
//   comment; ShotCommentsSection writeAuthoritative=true bypasses the
//   producer/crew canManageShots gate, which the comment rules already permit)
//   → minimal read-only meta (talent / location) → products read-only LAST
//   (ProductColorwayStrip readOnly=true).
//
// review-warehouse composition (the warehouse's job is to PULL): product-FORWARD
//   — ProductColorwayStrip readOnly FIRST (every look's garments, because the
//   warehouse pulls everything, not just the cover) → shot # / title /
//   read-only status context → read-only talent / location meta → comment
//   composer OPEN (same writeAuthoritative escape hatch as the client variant;
//   warehouse can leave notes). NO hero-led layout, NO prep status (no such
//   field exists in the model).
//
// Deliberately ABSENT (scoping boundaries, BOTH variants): no version-history
// section (edit-diff audit is a producer/crew tool, not a review affordance),
// no field editors, no lifecycle menu, no status tap-row (review surfaces don't
// write shots — status is shown read-only), no upload, no share.
import { useMemo } from "react"
import { useParams } from "react-router-dom"
import { LoadingState } from "@/shared/components/LoadingState"
import { DetailPageSkeleton } from "@/shared/components/Skeleton"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { useShotDetailBundle } from "@/features/shots/hooks/useShotDetailBundle"
import { useTalent } from "@/features/shots/hooks/usePickerData"
import { HeroImageSection } from "@/features/shots/components/HeroImageSection"
import { ShotCommentsSection } from "@/features/shots/components/ShotCommentsSection"
import { ProductColorwayStrip } from "@/features/shots/components/ProductColorwayStrip"
import { SectionLabel } from "@/features/shots/components/ShotDetailShared"
import { StatusBadge } from "@/shared/components/StatusBadge"
import { getShotStatusLabel, getShotStatusColor } from "@/shared/lib/statusMappings"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"

export type ReviewVariant = "review-client" | "review-warehouse"

export function ReviewShotDetail({ variant }: { readonly variant: ReviewVariant }) {
  const { sid } = useParams<{ sid: string }>()
  const { shot, loading, error } = useShotDetailBundle(sid)
  const { projectName } = useProjectScope()
  const { data: talentRecords } = useTalent()

  const talentNameById = useMemo(
    () => new Map(talentRecords.map((t) => [t.id, t.name])),
    [talentRecords],
  )

  if (loading) return <LoadingState loading skeleton={<DetailPageSkeleton />} />
  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      </div>
    )
  }
  if (!shot) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">Shot not found.</p>
      </div>
    )
  }
  if (shot.deleted === true) return null

  const talentIds = shot.talentIds ?? shot.talent ?? []
  const resolvedTalentNames = talentIds
    .map((id) => talentNameById.get(id))
    .filter((name): name is string => Boolean(name && name.trim()))
  const talentLine =
    talentIds.length === 0
      ? "—"
      : resolvedTalentNames.length > 0
        ? resolvedTalentNames.join(" · ")
        : `${talentIds.length} assigned`
  const locationLine = shot.locationName?.trim() || "—"

  // ── review-warehouse: PRODUCT-FORWARD read-only pull view. Products FIRST
  //    (every look), then identity/status context, meta, comment composer. ──
  if (variant === "review-warehouse") {
    return (
      <ErrorBoundary>
        <div
          className="mx-auto flex w-full max-w-2xl flex-col gap-5"
          data-testid="review-warehouse-detail"
        >
          {projectName && (
            <p className="truncate text-xs text-[var(--color-text-muted)]">
              {projectName}
            </p>
          )}

          {/* ── Products FIRST — the warehouse pulls every garment across all
              looks (ProductColorwayStrip renders all looks, read-only). ── */}
          <div data-testid="review-warehouse-products">
            <ProductColorwayStrip
              looks={shot.looks ?? []}
              activeLookId={shot.activeLookId}
              readOnly
            />
          </div>

          {/* ── Shot identity + read-only status context (no tap-row write). ── */}
          <header
            className="flex flex-col gap-1.5"
            data-testid="review-warehouse-identity"
          >
            <span className="text-2xs font-bold uppercase tracking-wider text-[var(--color-text-subtle)]">
              Shot{shot.shotNumber ? ` #${shot.shotNumber}` : ""}
            </span>
            <div className="flex flex-wrap items-baseline text-3xl">
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] [font-family:var(--font-serif)]">
                {shot.title || "Untitled Shot"}
              </h1>
              <span className="iconic-period" aria-hidden="true">
                .
              </span>
            </div>
            <div data-testid="review-warehouse-status-badge">
              <StatusBadge
                label={getShotStatusLabel(shot.status)}
                color={getShotStatusColor(shot.status)}
              />
            </div>
          </header>

          {/* ── Read-only talent / location meta. ── */}
          <section
            data-testid="review-warehouse-meta"
            className="flex flex-col gap-2"
          >
            <div>
              <SectionLabel>Talent</SectionLabel>
              <p className="mt-1 text-sm text-[var(--color-text)]">{talentLine}</p>
            </div>
            <div>
              <SectionLabel>Location</SectionLabel>
              <p className="mt-1 text-sm text-[var(--color-text)]">{locationLine}</p>
            </div>
          </section>

          {/* ── Comments — composer OPEN (same writeAuthoritative escape hatch
              as the client variant; warehouse can leave pull notes). ── */}
          <div data-testid="review-warehouse-composer">
            <ShotCommentsSection shotId={shot.id} canComment writeAuthoritative />
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      {/* Single column, image-led; centered at desktop density (Shoot-shell
          max-width precedent). */}
      <div
        className="mx-auto flex w-full max-w-2xl flex-col gap-5"
        data-testid="review-shot-detail"
      >
        {projectName && (
          <p className="truncate text-xs text-[var(--color-text-muted)]">{projectName}</p>
        )}

        {/* ── Hero / reference image FIRST — the client decides off the image
            (read-only, canUpload=false). Quietly absent when no hero. ── */}
        <HeroImageSection
          heroImage={shot.heroImage}
          shot={shot}
          shotId={shot.id}
          canUpload={false}
          frame="natural"
        />

        {/* ── Shot identity + read-only status badge (no tap-row: clients
            can't write shots, status is information only). ── */}
        <header className="flex flex-col gap-1.5" data-testid="review-shot-identity">
          <span className="text-2xs font-bold uppercase tracking-wider text-[var(--color-text-subtle)]">
            Shot{shot.shotNumber ? ` #${shot.shotNumber}` : ""}
          </span>
          <div className="flex flex-wrap items-baseline text-3xl">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] [font-family:var(--font-serif)]">
              {shot.title || "Untitled Shot"}
            </h1>
            {/* The iconic period — the single red accent (DESIGN.md masthead law). */}
            <span className="iconic-period" aria-hidden="true">
              .
            </span>
          </div>
          <div data-testid="review-status-badge">
            <StatusBadge
              label={getShotStatusLabel(shot.status)}
              color={getShotStatusColor(shot.status)}
            />
          </div>
        </header>

        {/* ── Comments — composer OPEN for clients (Q4). writeAuthoritative
            bypasses the producer/crew canManageShots gate; canComment=true. ── */}
        <div data-testid="review-client-composer">
          <ShotCommentsSection shotId={shot.id} canComment writeAuthoritative />
        </div>

        {/* ── Minimal read-only meta — talent / location. ── */}
        <section data-testid="review-shot-meta" className="flex flex-col gap-2">
          <div>
            <SectionLabel>Talent</SectionLabel>
            <p className="mt-1 text-sm text-[var(--color-text)]">{talentLine}</p>
          </div>
          <div>
            <SectionLabel>Location</SectionLabel>
            <p className="mt-1 text-sm text-[var(--color-text)]">{locationLine}</p>
          </div>
        </section>

        {/* ── Read-only product list LAST (the extracted 5e/5f seam). ── */}
        <ProductColorwayStrip
          looks={shot.looks ?? []}
          activeLookId={shot.activeLookId}
          readOnly
        />
      </div>
    </ErrorBoundary>
  )
}
