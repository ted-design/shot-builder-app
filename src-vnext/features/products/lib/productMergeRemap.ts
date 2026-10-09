import { resolveAssignmentImage } from "@/shared/lib/colourwayImage"

/**
 * Pure remapping of raw shot / pull data when a product family (the loser)
 * merges into another (the winner).
 *
 * Only rows whose family is the loser are touched: SKU doc ids are NOT
 * globally unique (the same id can exist under both families), so every
 * lookup is family-scoped. A loser colourway is remapped through the SKU map
 * to the winner colourway and takes the winner SKU's current photo or none;
 * nothing of the loser's colourway or family survives. A loser colourway with
 * no counterpart (e.g. its SKU was deleted before the merge) is CARRIED under
 * the winner with its id, name and its own photo, so the shot keeps saying
 * which colour it needs instead of silently becoming family-level.
 *
 * Rows of other families and carried rows are never dropped. A remapped loser
 * row is dropped only when it is the same assignment (family, colourway, size
 * scope and size) as a row that is kept; its hero star moves to that row.
 */

type Row = Record<string, unknown>

export interface WinnerSkuInfo {
  readonly name?: string
  readonly colorName?: string
  /** Storage path as stored on the SKU doc (pull items store paths). */
  readonly imagePath: string | null
  /** Download URL for `imagePath`, resolved as the assignment picker does; null when unresolved. */
  readonly imageUrl: string | null
}

export interface MergeRemapContext {
  readonly loserId: string
  readonly winnerId: string
  readonly winnerName: string | undefined
  /** Winner family image (header ?? thumbnail) as a download URL, as the picker writes it; null when none. */
  readonly winnerImageUrl: string | null
  readonly winnerStyleNumber: string | null
  readonly winnerGender: string | null
  /** Loser SKU id -> winner SKU id (matched by colour, plus SKUs transferred as new). */
  readonly skuMap: ReadonlyMap<string, string>
  /** Every winner SKU doc by id (soft-deleted included), read after the transfer step. */
  readonly winnerSkus: ReadonlyMap<string, WinnerSkuInfo>
}

/** Colourway and family fields of a stored assignment, including legacy keys. */
const COLOURWAY_FIELDS = ["skuId", "colourId", "skuName", "colourName", "skuImageUrl", "thumbUrl", "colourImagePath"]
const FAMILY_FIELDS = ["productId", "productName", "familyName", "familyImageUrl", "thumbnailImagePath"]

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function familyIdOf(row: Row): string | null {
  return nonEmpty(row.familyId) ?? nonEmpty(row.productId)
}

function colourwayIdOf(row: Row): string | null {
  return nonEmpty(row.skuId) ?? nonEmpty(row.colourId)
}

/** The colour a row shows: its colourway id, else (a carried row whose id was dropped) its colour name. */
function colourKeyOf(row: Row): string | null {
  const name = nonEmpty(row.colourName)
  return colourwayIdOf(row) ?? (name ? `name:${name}` : null)
}

/** True when a stored assignment or pull item belongs to the loser family (legacy `productId` included). */
export function isLoserRow(row: Row, ctx: Pick<MergeRemapContext, "loserId">): boolean {
  return familyIdOf(row) === ctx.loserId
}

function omit(row: Row, keys: ReadonlyArray<string>): Row {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)))
}

function pick(row: Row, keys: ReadonlyArray<string>): Row {
  return Object.fromEntries(Object.entries(row).filter(([key, value]) => keys.includes(key) && value != null))
}

/** Firestore rejects `undefined` values. */
function defined(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined))
}

/** The stored photo of this colourway itself — never the family fallback (same rule as the display resolver). */
function ownStoredPhoto(row: Row): string | null {
  return resolveAssignmentImage({
    familyId: "",
    skuId: nonEmpty(row.skuId) ?? undefined,
    colourId: nonEmpty(row.colourId) ?? undefined,
    thumbUrl: nonEmpty(row.thumbUrl) ?? undefined,
    skuImageUrl: nonEmpty(row.skuImageUrl) ?? nonEmpty(row.colourImagePath) ?? undefined,
    familyImageUrl: nonEmpty(row.familyImageUrl) ?? nonEmpty(row.thumbnailImagePath) ?? undefined,
  }).src
}

function photoFields(photo: string | null): Row {
  return photo ? { skuImageUrl: photo, thumbUrl: photo } : {}
}

function winnerFamilyFields(row: Row, ctx: MergeRemapContext): Row {
  return defined({
    familyId: ctx.winnerId,
    familyName: ctx.winnerName ?? nonEmpty(row.familyName) ?? nonEmpty(row.productName) ?? undefined,
    familyImageUrl: ctx.winnerImageUrl ?? undefined,
  })
}

/**
 * An unmatched loser colourway keeps its name and own photo. Its id is kept too,
 * unless the winner has a SKU with that same id: then the id would resolve to
 * that (different) winner colourway, so it is dropped.
 */
function carryUnmatched(row: Row, colourwayId: string, ctx: MergeRemapContext): Row {
  const keys = ctx.winnerSkus.has(colourwayId) ? ["skuName", "colourName"] : ["skuId", "colourId", "skuName", "colourName"]
  return { ...pick(row, keys), ...photoFields(ownStoredPhoto(row)) }
}

/** Remap one stored shot/look product assignment. Non-loser rows are returned unchanged. */
export function remapAssignmentForMerge(row: Row, ctx: MergeRemapContext): Row {
  if (!isLoserRow(row, ctx)) return row

  const base = { ...omit(row, [...COLOURWAY_FIELDS, ...FAMILY_FIELDS]), ...winnerFamilyFields(row, ctx) }
  const colourwayId = colourwayIdOf(row)
  if (!colourwayId) return base

  const mappedId = ctx.skuMap.get(colourwayId)
  if (!mappedId) return { ...base, ...carryUnmatched(row, colourwayId, ctx) }

  const sku = ctx.winnerSkus.get(mappedId)
  const colourName = nonEmpty(sku?.colorName) ?? nonEmpty(sku?.name) ?? nonEmpty(row.colourName) ?? nonEmpty(row.skuName)
  return defined({
    ...base,
    skuId: mappedId,
    colourId: mappedId,
    skuName: nonEmpty(sku?.name) ?? colourName ?? undefined,
    colourName: colourName ?? undefined,
    ...photoFields(sku?.imageUrl ?? null),
  })
}

/** Same identity as the app's assignment dedup (shotProducts `buildDedupKey`): family, colourway, size scope, size. */
function slotKey(row: Row): string {
  const scope = row.sizeScope === "all" || row.sizeScope === "single" ? row.sizeScope : "pending"
  const size = scope === "single" ? String(row.size ?? "") : scope
  return [familyIdOf(row) ?? "", colourwayIdOf(row) ?? "", scope, size].join("::")
}

interface RemappedList {
  readonly rows: Row[]
  /** Output index of the row each input row became (a dropped duplicate maps to the row holding its slot). */
  readonly outIndex: number[]
}

/**
 * How a row takes part in the dedupe: rows of other families are kept and hold
 * their slot; a loser row remapped to a winner colourway (or family-level) is
 * dropped if its slot is held; a carried (unmatched) loser colourway is neither
 * dropped nor holds a slot — with its id dropped on a collision, its slot would
 * look family-level.
 */
type SlotRole = "keep" | "dedupe" | "carry"

function slotRole(row: Row, ctx: MergeRemapContext): SlotRole {
  if (!isLoserRow(row, ctx)) return "keep"
  const colourwayId = colourwayIdOf(row)
  return colourwayId && !ctx.skuMap.has(colourwayId) ? "carry" : "dedupe"
}

/** For each input row, the input index of the row it ends up as: itself, or the kept row already holding its slot. */
function slotHolders(remapped: ReadonlyArray<Row>, roles: ReadonlyArray<SlotRole>): number[] {
  const holder = new Map<string, number>()
  remapped.forEach((row, i) => {
    if (roles[i] === "keep" && !holder.has(slotKey(row))) holder.set(slotKey(row), i)
  })
  const holderOf: number[] = []
  for (const [i, row] of remapped.entries()) {
    const held = roles[i] === "dedupe" ? holder.get(slotKey(row)) : undefined
    if (roles[i] === "dedupe" && held === undefined) holder.set(slotKey(row), i)
    holderOf.push(held ?? i)
  }
  return holderOf
}

function remapAssignments(rows: ReadonlyArray<Row>, ctx: MergeRemapContext): RemappedList {
  const remapped = rows.map((row) => remapAssignmentForMerge(row, ctx))
  const holderOf = slotHolders(remapped, rows.map((row) => slotRole(row, ctx)))
  const starred = new Set(holderOf.filter((h, i) => h !== i && remapped[i]!.isHero === true))
  const kept = holderOf.flatMap((h, i) => (h === i ? [i] : []))
  const position = new Map(kept.map((i, pos) => [i, pos]))
  return {
    rows: kept.map((i) => (starred.has(i) && remapped[i]!.isHero !== true ? { ...remapped[i]!, isHero: true } : remapped[i]!)),
    outIndex: holderOf.map((h) => position.get(h)!),
  }
}

/** The cover rule: first product whose skuId, colourId or familyId equals the hero id. */
function heroMatchIndex(rows: ReadonlyArray<Row>, id: string): number {
  return rows.findIndex((p) => p.skuId === id || p.colourId === id || familyIdOf(p) === id)
}

/**
 * Remap a look's heroProductId so it resolves to the same assignment after the
 * merge as before (a family-id hero stays a family id where that still points
 * at it), or else to a row of the same family and colourway. When no id can,
 * the hero is cleared rather than pointed at another colour or product. A hero
 * that resolves to nothing today is left as it is.
 */
function remapHero(hero: unknown, before: ReadonlyArray<Row>, after: RemappedList): unknown {
  if (typeof hero !== "string" || hero.length === 0) return hero
  const target = heroMatchIndex(before, hero)
  if (target < 0) return hero

  const finalIndex = after.outIndex[target]!
  const finalRow = after.rows[finalIndex]!
  const ids = familyIdOf(before[target]!) === hero
    ? [familyIdOf(finalRow), colourwayIdOf(finalRow)]
    : [colourwayIdOf(finalRow), familyIdOf(finalRow)]
  const candidates = [hero, ...ids.filter((id): id is string => id !== null)]
  const sameColourway = (index: number) =>
    index >= 0 && familyIdOf(after.rows[index]!) === familyIdOf(finalRow) && colourKeyOf(after.rows[index]!) === colourKeyOf(finalRow)
  return candidates.find((id) => heroMatchIndex(after.rows, id) === finalIndex)
    ?? candidates.find((id) => sameColourway(heroMatchIndex(after.rows, id)))
    ?? null
}

function rowsOf(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : []
}

/** Remap a shot's root `products` mirror and every look. `changed` is false when nothing referenced the loser. */
export function remapShotForMerge(
  shot: { readonly products?: unknown; readonly looks?: unknown },
  ctx: MergeRemapContext,
): { readonly changed: boolean; readonly products: Row[]; readonly looks: Row[] } {
  const touches = (rows: ReadonlyArray<Row>) => rows.some((row) => isLoserRow(row, ctx))
  const rootRows = rowsOf(shot.products)
  const lookList = rowsOf(shot.looks)

  const looks = lookList.map((look) => {
    const before = rowsOf(look.products)
    const after = remapAssignments(before, ctx)
    const hero = remapHero(look.heroProductId, before, after)
    return { ...look, products: after.rows, ...(hero !== look.heroProductId ? { heroProductId: hero } : {}) }
  })

  return {
    changed: touches(rootRows) || lookList.some((look) => touches(rowsOf(look.products))),
    products: remapAssignments(rootRows, ctx).rows,
    looks,
  }
}

/**
 * Remap one pull item. Only items with the loser's `familyId` are touched (the
 * app ignores pull items without one). Loser colour ids go through the SKU map
 * (colour name and image path follow the winner SKU); an unmatched colour is
 * carried, minus an id that names a winner SKU. Family fields the item already
 * has (style number, gender) take the winner's value or null. Pull items are
 * NOT deduped: each carries its own sizes/fulfilment.
 */
export function remapPullItemForMerge(item: Row, ctx: MergeRemapContext): Row {
  if (nonEmpty(item.familyId) !== ctx.loserId) return item
  const out = defined({
    ...omit(item, ["productId", "productName"]),
    familyId: ctx.winnerId,
    familyName: ctx.winnerName ?? item.familyName,
    ...("styleNumber" in item ? { styleNumber: ctx.winnerStyleNumber } : {}),
    ...("gender" in item ? { gender: ctx.winnerGender } : {}),
  })
  const colourId = nonEmpty(item.colourId)
  const mappedId = colourId ? ctx.skuMap.get(colourId) : undefined
  if (!mappedId) return colourId && ctx.winnerSkus.has(colourId) ? { ...out, colourId: null } : out
  const sku = ctx.winnerSkus.get(mappedId)
  return defined({
    ...out,
    colourId: mappedId,
    colourName: nonEmpty(sku?.colorName) ?? nonEmpty(sku?.name) ?? item.colourName,
    ...("colourImagePath" in item ? { colourImagePath: sku?.imagePath ?? null } : {}),
  })
}
