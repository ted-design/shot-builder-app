import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { Modal } from "../ui/modal";
import { toast } from "../../lib/toast";
import { submitPublicPullUpdate } from "../../lib/publicPullUpdates";
import { normalizePullItem, sortPullItemsByGender } from "../../lib/pullItems";

const EMAIL_STORAGE_PREFIX = "pullShareEmail:";

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

function AddItemModal({ open, onClose, onSubmit, busy }) {
  const [familyName, setFamilyName] = useState("");
  const [styleNumber, setStyleNumber] = useState("");
  const [gender, setGender] = useState("");
  const [notes, setNotes] = useState("");
  const [sizes, setSizes] = useState([{ size: "", quantity: 1 }]);

  useEffect(() => {
    if (!open) return;
    setFamilyName("");
    setStyleNumber("");
    setGender("");
    setNotes("");
    setSizes([{ size: "", quantity: 1 }]);
  }, [open]);

  if (!open) return null;

  const canSubmit =
    familyName.trim().length > 0 &&
    sizes.some((entry) => entry.size.trim() && Number(entry.quantity) > 0);

  return (
    <Modal open onClose={onClose} labelledBy="public-add-item-title" contentClassName="max-w-xl">
      <Card className="border-0 shadow-none">
        <CardHeader>
          <h2 id="public-add-item-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Add item
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Add a line item to this pull sheet. Use product name + size breakdown.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Product name</label>
            <Input value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="e.g. Classic Tee" disabled={busy} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Style # (optional)</label>
              <Input value={styleNumber} onChange={(e) => setStyleNumber(e.target.value)} placeholder="e.g. UB-123" disabled={busy} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Gender (optional)</label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={busy}
              >
                <option value="">Unspecified</option>
                <option value="Mens">Mens</option>
                <option value="Womens">Womens</option>
                <option value="Unisex">Unisex</option>
                <option value="Kids">Kids</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Sizes</div>
            <div className="space-y-2">
              {sizes.map((entry, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_120px_auto] gap-2">
                  <Input
                    value={entry.size}
                    onChange={(e) => {
                      const next = sizes.slice();
                      next[idx] = { ...next[idx], size: e.target.value };
                      setSizes(next);
                    }}
                    placeholder="Size (e.g. M)"
                    disabled={busy}
                  />
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={entry.quantity}
                    onChange={(e) => {
                      const next = sizes.slice();
                      next[idx] = { ...next[idx], quantity: e.target.value };
                      setSizes(next);
                    }}
                    disabled={busy}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSizes((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={busy || sizes.length <= 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="secondary" onClick={() => setSizes((prev) => [...prev, { size: "", quantity: 1 }])} disabled={busy}>
              Add size
            </Button>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes (optional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes for this item" disabled={busy} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => onSubmit({ familyName, styleNumber, gender, notes, sizes })}
              disabled={busy || !canSubmit}
            >
              {busy ? "Adding..." : "Add item"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}

export default function PullPublicResponder({ shareToken, pull, onPullUpdated }) {
  const [email, setEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [savingItemId, setSavingItemId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [editsByItemId, setEditsByItemId] = useState({});

  const items = useMemo(() => {
    const normalized = (pull?.items || []).map((item) => normalizePullItem(item));
    return sortPullItemsByGender(normalized);
  }, [pull]);

  useEffect(() => {
    const stored = window.localStorage.getItem(`${EMAIL_STORAGE_PREFIX}${shareToken}`);
    if (stored && isValidEmail(stored)) {
      setEmail(stored);
      setEmailConfirmed(true);
    }
  }, [shareToken]);

  const handleConfirmEmail = () => {
    const next = String(email || "").trim();
    if (!isValidEmail(next)) {
      toast.error({ title: "Enter a valid email address" });
      return;
    }
    window.localStorage.setItem(`${EMAIL_STORAGE_PREFIX}${shareToken}`, next);
    setEmail(next);
    setEmailConfirmed(true);
  };

  const updateSizeDraft = (itemId, sizeLabel, patch) => {
    setEditsByItemId((prev) => {
      const next = { ...prev };
      const itemEdits = { ...(next[itemId] || {}) };
      itemEdits[sizeLabel] = { ...(itemEdits[sizeLabel] || {}), ...patch };
      next[itemId] = itemEdits;
      return next;
    });
  };

  const getDraft = (itemId, sizeLabel) => editsByItemId?.[itemId]?.[sizeLabel] || null;

  const hasItemEdits = (itemId) => {
    const entry = editsByItemId?.[itemId];
    return entry && Object.keys(entry).length > 0;
  };

  const handleSaveItem = async (item) => {
    const itemId = item.id;
    const itemDraft = editsByItemId?.[itemId];
    if (!itemDraft || Object.keys(itemDraft).length === 0) return;

    const sizes = Object.entries(itemDraft).map(([size, change]) => ({
      size,
      fulfilled: change.fulfilled,
      status: change.status,
    }));

    setSavingItemId(itemId);
    try {
      const updatedPull = await submitPublicPullUpdate({
        shareToken,
        email,
        actions: [
          {
            type: "updateFulfillment",
            itemId,
            sizes,
          },
        ],
      });
      if (updatedPull) {
        onPullUpdated?.(updatedPull);
      }
      setEditsByItemId((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      toast.success({ title: "Saved updates" });
    } catch (error) {
      console.error("[PullPublicResponder] Failed to save updates", error);
      toast.error({ title: "Failed to save updates" });
    } finally {
      setSavingItemId(null);
    }
  };

  const handleAddItem = async (itemInput) => {
    setAddBusy(true);
    try {
      const updatedPull = await submitPublicPullUpdate({
        shareToken,
        email,
        actions: [
          {
            type: "addItem",
            item: itemInput,
          },
        ],
      });
      if (updatedPull) {
        onPullUpdated?.(updatedPull);
      }
      setAddOpen(false);
      toast.success({ title: "Item added" });
    } catch (error) {
      console.error("[PullPublicResponder] Failed to add item", error);
      toast.error({ title: "Failed to add item" });
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Warehouse response</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Update fulfillment amounts, or add items. Your email will be recorded with each update.
              </p>
            </div>
            {emailConfirmed ? (
              <Button type="button" variant="secondary" onClick={() => setAddOpen(true)}>
                Add item
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {!emailConfirmed ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email to respond"
                type="email"
                className="sm:flex-1"
              />
              <Button type="button" onClick={handleConfirmEmail} disabled={!isValidEmail(email)}>
                Continue
              </Button>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Responding as <span className="font-semibold">{email}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {emailConfirmed ? (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.familyName || "Item"}
                    </div>
                    {item.styleNumber ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400">Style: {item.styleNumber}</div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleSaveItem(item)}
                    disabled={!hasItemEdits(item.id) || savingItemId === item.id}
                  >
                    {savingItemId === item.id ? "Saving..." : "Save updates"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        <th className="py-2 pr-3">Size</th>
                        <th className="py-2 pr-3 text-center">Requested</th>
                        <th className="py-2 pr-3 text-center">Fulfilled</th>
                        <th className="py-2 pr-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(item.sizes || []).map((size) => {
                        const draft = getDraft(item.id, size.size);
                        const fulfilledValue = draft?.fulfilled ?? size.fulfilled ?? 0;
                        const statusValue = draft?.status ?? size.status ?? "pending";
                        return (
                          <tr key={size.size} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">{size.size}</td>
                            <td className="py-2 pr-3 text-center text-slate-700 dark:text-slate-300">{size.quantity}</td>
                            <td className="py-2 pr-3 text-center">
                              <Input
                                type="number"
                                min="0"
                                max={size.quantity}
                                step="1"
                                value={fulfilledValue}
                                onChange={(e) => {
                                  const next = Math.max(0, Math.min(size.quantity, Number(e.target.value || 0)));
                                  updateSizeDraft(item.id, size.size, { fulfilled: next });
                                }}
                                className="mx-auto w-24 text-center"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <select
                                value={statusValue}
                                onChange={(e) => updateSizeDraft(item.id, size.size, { status: e.target.value })}
                                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                              >
                                <option value="pending">Pending</option>
                                <option value="fulfilled">Fulfilled</option>
                                <option value="substituted">Substituted</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <AddItemModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddItem}
        busy={addBusy}
      />
    </>
  );
}

