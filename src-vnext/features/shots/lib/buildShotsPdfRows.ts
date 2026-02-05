import { formatDateOnly } from "@/features/shots/lib/dateOnly"
import { textPreview } from "@/shared/lib/textPreview"
import type { Shot } from "@/shared/types"
import { getShotPrimaryLookProductLabels, resolveIdsToNames } from "@/features/shots/lib/shotListSummaries"
import type { ShotsPdfRow } from "@/features/shots/lib/shotsPdfTemplates"
import { resolvePdfImageSrc } from "@/features/shots/lib/resolvePdfImageSrc"

export async function buildShotsPdfRows({
  shots,
  includeHero,
  talentNameById,
  locationNameById,
}: {
  readonly shots: readonly Shot[]
  readonly includeHero: boolean
  readonly talentNameById?: ReadonlyMap<string, string> | null
  readonly locationNameById?: ReadonlyMap<string, string> | null
}): Promise<ShotsPdfRow[]> {
  const rows = await Promise.all(
    shots.map(async (shot): Promise<ShotsPdfRow> => {
      const title = shot.title || "Untitled Shot"
      const heroCandidate = shot.heroImage?.path ?? shot.heroImage?.downloadURL ?? null
      const heroImageUrl =
        includeHero && heroCandidate
          ? await resolvePdfImageSrc(heroCandidate).catch(() => null)
          : null

      const talentIds = shot.talentIds ?? shot.talent
      const { names: talentNames, unknownCount } = resolveIdsToNames(
        talentIds,
        talentNameById,
      )
      const talentLines =
        unknownCount > 0
          ? [...talentNames, `+${unknownCount} unknown`]
          : talentNames

      const locationLabel =
        shot.locationName ??
        (shot.locationId ? locationNameById?.get(shot.locationId) ?? "Location selected" : null)

      return {
        id: shot.id,
        title,
        shotNumber: shot.shotNumber ?? null,
        status: shot.status ?? null,
        dateLabel: formatDateOnly(shot.date) || null,
        locationLabel,
        talentLines,
        productLines: getShotPrimaryLookProductLabels(shot),
        description: shot.description ? textPreview(shot.description, 300) : null,
        notesAddendum: shot.notesAddendum ? textPreview(shot.notesAddendum, 800) : null,
        heroImageUrl,
      }
    }),
  )

  return rows
}
