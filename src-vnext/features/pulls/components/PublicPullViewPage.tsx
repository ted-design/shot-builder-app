import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { collectionGroup, getDocs, limit, query, where } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { toast } from "sonner"
import { db, functions } from "@/shared/lib/firebase"
import { LoadingState } from "@/shared/components/LoadingState"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Separator } from "@/ui/separator"
import type { Pull, PullItem } from "@/shared/types"
import { mapPull } from "@/features/pulls/lib/mapPull"

type PublicUpdatePullPayload = {
  readonly shareToken: string
  readonly email: string
  readonly actions: readonly {
    readonly type: "updateFulfillment"
    readonly itemId: string
    readonly sizes: readonly { readonly size: string; readonly fulfilled: number }[]
  }[]
}

function isExpired(pull: Pull): boolean {
  const ts = pull.shareExpireAt ?? pull.shareExpiresAt ?? null
  if (!ts) return false
  try {
    return ts.toDate().getTime() < Date.now()
  } catch {
    return false
  }
}

function deepCloneItems(items: readonly PullItem[]): PullItem[] {
  return items.map((item) => ({
    ...item,
    sizes: Array.isArray(item.sizes) ? item.sizes.map((s) => ({ ...s })) : [],
    changeOrders: item.changeOrders ? [...item.changeOrders] : undefined,
  }))
}

export default function PublicPullViewPage() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [pull, setPull] = useState<Pull | null>(null)
  const [draftItems, setDraftItems] = useState<PullItem[]>([])
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canRespond = useMemo(() => {
    if (!pull) return false
    if (!pull.shareEnabled) return false
    if (isExpired(pull)) return false
    return pull.shareAllowResponses === true
  }, [pull])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!shareToken) {
        setError("No share token provided.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const pullsRef = collectionGroup(db, "pulls")
        const q = query(
          pullsRef,
          where("shareToken", "==", shareToken),
          where("shareEnabled", "==", true),
          limit(1),
        )
        const snapshot = await getDocs(q)
        if (!active) return
        if (snapshot.empty) {
          setError("Pull not found or sharing is disabled.")
          setPull(null)
          setDraftItems([])
          setLoading(false)
          return
        }

        const doc = snapshot.docs[0]!
        const next = mapPull(doc.id, doc.data() as Record<string, unknown>)
        setPull(next)
        setDraftItems(deepCloneItems(next.items))
        setLoading(false)
      } catch (err) {
        if (!active) return
        console.error("[PublicPullViewPage] Failed to load pull:", err)
        setError("Failed to load pull. Please check the link and try again.")
        setPull(null)
        setDraftItems([])
        setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [shareToken])

  const submit = async () => {
    if (!shareToken || !pull) return
    if (!canRespond) return

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      toast.error("Email is required to submit updates.")
      return
    }

    const originalItems = pull.items
    const actions: Array<PublicUpdatePullPayload["actions"][number]> = []

    for (const draft of draftItems) {
      const itemId = draft.id
      if (!itemId) continue
      const original = originalItems.find((it) => it.id === itemId)
      if (!original) continue

      const sizeUpdates: { size: string; fulfilled: number }[] = []
      for (const size of draft.sizes) {
        const originalSize = original.sizes.find((s) => s.size === size.size)
        if (!originalSize) continue
        const quantity = Number.isFinite(size.quantity) ? size.quantity : 0
        const nextFulfilled = Math.max(0, Math.min(quantity, Number(size.fulfilled) || 0))
        if (nextFulfilled === (Number(originalSize.fulfilled) || 0)) continue
        sizeUpdates.push({ size: size.size, fulfilled: nextFulfilled })
      }

      if (sizeUpdates.length > 0) {
        actions.push({ type: "updateFulfillment", itemId, sizes: sizeUpdates })
      }
    }

    if (actions.length === 0) {
      toast.info("No changes to submit.")
      return
    }

    setSaving(true)
    try {
      const callable = httpsCallable(functions, "publicUpdatePull")
      await callable({
        shareToken,
        email: trimmedEmail,
        actions,
      } satisfies PublicUpdatePullPayload)
      toast.success("Updates submitted.")
      // Reload from Firestore (single query) to confirm canonical state.
      setLoading(true)
      setError(null)
      const pullsRef = collectionGroup(db, "pulls")
      const q = query(
        pullsRef,
        where("shareToken", "==", shareToken),
        where("shareEnabled", "==", true),
        limit(1),
      )
      const snapshot = await getDocs(q)
      if (snapshot.empty) {
        setError("Pull not found or sharing is disabled.")
        setPull(null)
        setDraftItems([])
      } else {
        const doc = snapshot.docs[0]!
        const next = mapPull(doc.id, doc.data() as Record<string, unknown>)
        setPull(next)
        setDraftItems(deepCloneItems(next.items))
      }
    } catch (err) {
      console.error("[PublicPullViewPage] Failed to submit updates:", err)
      toast.error("Failed to submit updates. Please try again.")
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  if (loading) return <LoadingState loading />

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
        <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h1 className="text-base font-semibold text-[var(--color-text)]">Access denied</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{error}</p>
        </div>
      </div>
    )
  }

  if (!pull) return null

  const title = pull.title || pull.name || "Pull Sheet"
  const expired = isExpired(pull)
  const respondLabel = expired ? "Expired" : canRespond ? "Respond enabled" : "Read-only"

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
              Shared view
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">{respondLabel}</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">{title}</h1>
        </div>

        {canRespond ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Submit updates</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="public-email">Your email</Label>
                  <Input
                    id="public-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    inputMode="email"
                    autoComplete="email"
                  />
                </div>
                <Button onClick={submit} disabled={saving}>
                  {saving ? "Submitting..." : "Submit updates"}
                </Button>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Updates are recorded on the pull sheet using your email address (not verified).
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Separator />

        {draftItems.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-[var(--color-text-muted)]">No items in this pull sheet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {draftItems.map((item) => (
              <PublicPullItemCard
                key={item.id ?? `${item.familyId}:${item.colourId ?? ""}`}
                item={item}
                editable={canRespond}
                onChange={(next) => {
                  setDraftItems((prev) =>
                    prev.map((it) => (it.id && next.id && it.id === next.id ? next : it)),
                  )
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PublicPullItemCard({
  item,
  editable,
  onChange,
}: {
  readonly item: PullItem
  readonly editable: boolean
  readonly onChange: (next: PullItem) => void
}) {
  const canEditItem = editable && typeof item.id === "string" && item.id.length > 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {item.familyName ?? item.familyId}
          {item.colourName ? (
            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
              {item.colourName}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!canEditItem && editable ? (
          <p className="text-xs text-[var(--color-text-muted)]">
            This line item cannot be updated (missing item id).
          </p>
        ) : null}

        {item.sizes.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No sizes listed.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {item.sizes.map((s) => (
              <div
                key={s.size}
                className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--color-text)]">{s.size}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Qty {s.quantity}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-[var(--color-text-muted)]">Fulfilled</Label>
                  <Input
                    value={String(s.fulfilled ?? 0)}
                    onChange={(e) => {
                      const nextFulfilled = Number(e.target.value)
                      const clamped = Math.max(0, Math.min(s.quantity, Number.isFinite(nextFulfilled) ? nextFulfilled : 0))
                      onChange({
                        ...item,
                        sizes: item.sizes.map((sizeRow) =>
                          sizeRow.size === s.size ? { ...sizeRow, fulfilled: clamped } : sizeRow,
                        ),
                      })
                    }}
                    type="number"
                    min={0}
                    max={s.quantity}
                    disabled={!canEditItem}
                    className="h-8 w-20 text-center"
                    inputMode="numeric"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {item.notes ? (
          <p className="text-xs text-[var(--color-text-muted)]">{item.notes}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
