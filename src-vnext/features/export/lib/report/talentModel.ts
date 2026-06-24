import type { Shot, TalentRecord } from "@/shared/types"
import { buildDisplayName } from "@/features/library/components/talentUtils"
import {
  genderDisplayLabel,
  formatLabeledMeasurements,
} from "@/features/library/lib/measurementOptions"
import type { ExportData } from "../../hooks/useExportData"
import { formatDateWindow, lookLabel, shotNumberSortKey, sortLooksByOrder, titleCaseSlug } from "./reportModel"
import type {
  TalentAppearance,
  TalentConfig,
  TalentEntry,
  TalentGroup,
  TalentMeasurement,
  TalentModel,
} from "./talentTypes"

// Pure derivation: ExportData + TalentConfig -> TalentModel. No async, no image
// bytes (headshot is a path/URL candidate resolved later). The single source both
// the DOM (TalentReportView) and PDF renderers consume.

const NO_AGENCY = "No agency"
const UNRESOLVED = "Unresolved"

// Stable lead order for gender buckets; any label outside this list sorts alpha
// after these, and the blank-gender "Unresolved" bucket is always pinned last.
const GENDER_ORDER: readonly string[] = ["Female", "Male", "Non-binary", "Other"]

// Build the per-talent appearance list: ONE entry per non-deleted shot the talent
// is slotted into (shot.talentIds includes the id). Looks have no talentIds, so a
// talent inherits ALL of that shot's look labels (deduped, look-order preserved).
function buildAppearances(
  talentId: string,
  shots: readonly Shot[],
): readonly TalentAppearance[] {
  const out: TalentAppearance[] = []
  for (const shot of shots) {
    if (shot.deleted) continue
    if (!(shot.talentIds ?? []).includes(talentId)) continue
    const looks = sortLooksByOrder(shot.looks ?? [])
    const labels: string[] = []
    looks.forEach((look, i) => {
      const label = lookLabel(look.label, i)
      if (!labels.includes(label)) labels.push(label)
    })
    out.push({
      number: shot.shotNumber ?? "",
      title: shot.title || "Untitled shot",
      looks: labels,
      status: shot.status,
    })
  }
  return out.sort((a, b) => {
    const [ak, an, as] = shotNumberSortKey(a.number)
    const [bk, bn, bs] = shotNumberSortKey(b.number)
    return ak - bk || an - bn || as.localeCompare(bs)
  })
}

function toEntry(
  t: TalentRecord,
  shots: readonly Shot[],
  excluded: ReadonlySet<string>,
): TalentEntry {
  const appears = buildAppearances(t.id, shots)
  const label = genderDisplayLabel(t.gender)
  const measurements = formatLabeledMeasurements(
    t.measurements,
    t.gender,
    "labeled",
  ) as readonly TalentMeasurement[]
  return {
    id: t.id,
    name: buildDisplayName(t),
    gender: t.gender ?? null,
    genderLabel: label === "" ? null : label,
    agency: t.agency?.trim() ? t.agency.trim() : null,
    email: t.email?.trim() ? t.email.trim() : null,
    phone: t.phone?.trim() ? t.phone.trim() : null,
    web: t.url?.trim() ? t.url.trim() : null,
    headshot: t.headshotUrl ?? t.imageUrl ?? t.headshotPath ?? null,
    measurements,
    excluded: excluded.has(t.id),
    appears,
  }
}

// in-shots: talent slotted into any non-deleted shot, resolved against the library
// (drop soft-deleted records). Order is stabilized by the later alpha sort.
function inShotsTalent(data: ExportData): readonly TalentRecord[] {
  const byId = new Map(data.talent.map((t) => [t.id, t]))
  const ids = new Set<string>()
  for (const shot of data.shots) {
    if (shot.deleted) continue
    for (const id of shot.talentIds ?? []) ids.add(id)
  }
  return [...ids]
    .map((id) => byId.get(id))
    .filter((t): t is TalentRecord => t != null && t.deleted !== true)
}

// project-attached: every non-deleted talent whose projectIds includes this project.
function projectAttachedTalent(data: ExportData): readonly TalentRecord[] {
  const projectId = data.project?.id
  return data.talent.filter(
    (t) => t.deleted !== true && !!projectId && (t.projectIds ?? []).includes(projectId),
  )
}

function groupEntries(
  items: readonly TalentEntry[],
  groupBy: TalentConfig["groupBy"],
): readonly TalentGroup[] {
  if (groupBy === "none") {
    return [{ key: "all", label: "All talent", count: items.length, items }]
  }
  if (groupBy === "gender") {
    const byLabel = new Map<string, TalentEntry[]>()
    for (const item of items) {
      const key = item.genderLabel ?? UNRESOLVED
      const bucket = byLabel.get(key)
      if (bucket) bucket.push(item)
      else byLabel.set(key, [item])
    }
    return [...byLabel.keys()]
      .sort(genderBucketSort)
      .map((key): TalentGroup => {
        const inGroup = byLabel.get(key) ?? []
        return { key, label: key, count: inGroup.length, items: inGroup }
      })
  }
  // agency
  const byAgency = new Map<string, TalentEntry[]>()
  for (const item of items) {
    const key = item.agency ?? NO_AGENCY
    const bucket = byAgency.get(key)
    if (bucket) bucket.push(item)
    else byAgency.set(key, [item])
  }
  return [...byAgency.keys()]
    .sort(agencyBucketSort)
    .map((key): TalentGroup => {
      const inGroup = byAgency.get(key) ?? []
      return { key, label: key, count: inGroup.length, items: inGroup }
    })
}

// Lead-ordered gender buckets, then unknown labels alpha, Unresolved always last.
function genderBucketSort(a: string, b: string): number {
  if (a === UNRESOLVED) return b === UNRESOLVED ? 0 : 1
  if (b === UNRESOLVED) return -1
  const ai = GENDER_ORDER.indexOf(a)
  const bi = GENDER_ORDER.indexOf(b)
  if (ai !== -1 && bi !== -1) return ai - bi
  if (ai !== -1) return -1
  if (bi !== -1) return 1
  return a.localeCompare(b)
}

// Agencies alpha; the catch-all "No agency" bucket always last.
function agencyBucketSort(a: string, b: string): number {
  if (a === NO_AGENCY) return b === NO_AGENCY ? 0 : 1
  if (b === NO_AGENCY) return -1
  return a.localeCompare(b)
}

/** Derive the resolved talent model from live export data + config. */
export function deriveTalentModel(data: ExportData, config: TalentConfig): TalentModel {
  const excluded = new Set(config.excludedTalentIds)
  const records =
    config.talentScope === "project-attached"
      ? projectAttachedTalent(data)
      : inShotsTalent(data)

  const items = records
    .map((t) => toEntry(t, data.shots, excluded))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    project: {
      name: data.project?.name ?? "Untitled project",
      client: titleCaseSlug(data.project?.clientId),
      dateRange: formatDateWindow(data.project?.shootDates),
      talentCount: items.length,
    },
    groups: groupEntries(items, config.groupBy),
  }
}

/** Collect every unique headshot candidate referenced by the talent model. */
export function collectTalentImageCandidates(model: TalentModel): readonly string[] {
  const set = new Set<string>()
  for (const group of model.groups) {
    for (const item of group.items) if (item.headshot) set.add(item.headshot)
  }
  return [...set]
}
