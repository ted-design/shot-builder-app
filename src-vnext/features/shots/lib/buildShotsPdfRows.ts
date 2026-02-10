import { formatDateOnly } from "@/features/shots/lib/dateOnly"
import { textPreview } from "@/shared/lib/textPreview"
import type { Shot } from "@/shared/types"
import { getShotPrimaryLookProductLabels, resolveIdsToNames } from "@/features/shots/lib/shotListSummaries"
import type { ShotsPdfRow } from "@/features/shots/lib/shotsPdfTemplates"
import { resolvePdfImageSrc } from "@/features/shots/lib/resolvePdfImageSrc"

function replaceSpecialLatin(value: string): string {
  return value
    .replace(/ß/g, "ss")
    .replace(/Æ/g, "AE")
    .replace(/æ/g, "ae")
    .replace(/Œ/g, "OE")
    .replace(/œ/g, "oe")
    .replace(/Ø/g, "O")
    .replace(/ø/g, "o")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .replace(/Ł/g, "L")
    .replace(/ł/g, "l")
    .replace(/Þ/g, "Th")
    .replace(/þ/g, "th")
    .replace(/Ð/g, "D")
    .replace(/ð/g, "d")
}

/**
 * Normalize user-entered text to PDF-safe glyphs.
 * React PDF's built-in fonts can render unexpected symbols for some pasted Unicode.
 */
export function normalizePdfTextForRender(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, "\"")
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, " - ")
    .replace(/\u2026/g, "...")
    .replace(/[×✕✖]/g, "x")
    .replace(/[÷∕]/g, "/")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\u2122/g, "TM")
    .replace(/\u00AE/g, "(R)")
    .replace(/\u00A9/g, "(C)")
  const latinSafe = replaceSpecialLatin(normalized)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, " ")
  const collapsed = latinSafe
    .replace(/\s+/g, " ")
    .trim()

  return collapsed.length > 0 ? collapsed : null
}

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
      const title = normalizePdfTextForRender(shot.title) || "Untitled Shot"
      // Keep hero source priority aligned with the on-screen shot cards.
      const heroCandidate = shot.heroImage?.downloadURL ?? shot.heroImage?.path ?? null
      const heroImageRequested = includeHero && !!heroCandidate
      const heroImageUrl =
        heroImageRequested
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
      const safeTalentLines = talentLines
        .map((line) => normalizePdfTextForRender(line))
        .filter((line): line is string => !!line)

      const locationLabel =
        normalizePdfTextForRender(shot.locationName) ??
        normalizePdfTextForRender(shot.locationId ? locationNameById?.get(shot.locationId) ?? "Location selected" : null)

      const safeProductLines = getShotPrimaryLookProductLabels(shot)
        .map((line) => normalizePdfTextForRender(line))
        .filter((line): line is string => !!line)

      return {
        id: shot.id,
        title,
        shotNumber: normalizePdfTextForRender(shot.shotNumber ?? null),
        status: shot.status ?? null,
        dateLabel: formatDateOnly(shot.date) || null,
        locationLabel,
        talentLines: safeTalentLines,
        productLines: safeProductLines,
        description: normalizePdfTextForRender(shot.description ? textPreview(shot.description, 300) : null),
        notesAddendum: normalizePdfTextForRender(shot.notesAddendum ? textPreview(shot.notesAddendum, 800) : null),
        heroImageRequested,
        heroImageMissing: heroImageRequested && !heroImageUrl,
        heroImageUrl,
      }
    }),
  )

  return rows
}
