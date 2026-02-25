/**
 * ShotNotesCanvas — Shot notes trust surface (vNext).
 *
 * Slice 2 contract:
 * - `shot.notes` is legacy TipTap HTML and is treated as immutable (read-only render only).
 * - Operational updates are append-only via `shot.notesAddendum` (plain text).
 */

import { useCallback, useMemo, useState } from "react";
import { FileText, Eye } from "lucide-react";
import { format } from "date-fns";

import { useAuth } from "../../../context/AuthContext";
import { formatRelativeTime } from "../../../lib/notifications";
import { sanitizeHtml, isEmptyHtml } from "../../../lib/sanitizeHtml";
import { updateShotWithVersion } from "../../../lib/updateShotWithVersion";
import { toast } from "../../../lib/toast";

function TrustIndicator({ lastSaved, lastEditedBy }) {
  if (!lastSaved) return null;
  const timeAgo = formatRelativeTime(lastSaved);
  return (
    <span className="text-xs text-slate-400 dark:text-slate-500">
      Last edited {timeAgo}
      {lastEditedBy ? ` by ${lastEditedBy}` : ""}
    </span>
  );
}

function NotesReadOnlyDisplay({ html }) {
  if (isEmptyHtml(html)) {
    return (
      <span className="text-slate-400 dark:text-slate-500 italic">
        No notes added yet.
      </span>
    );
  }

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}

export default function ShotNotesCanvas({ shot, readOnly = false }) {
  const auth = useAuth();
  const clientId = auth?.clientId;
  const user = auth?.user;

  const [addendumDraft, setAddendumDraft] = useState("");
  const [addendumSaving, setAddendumSaving] = useState(false);

  const lastEditedBy = shot?.notesUpdatedBy?.displayName || null;
  const lastSaved = shot?.notesUpdatedAt || null;
  const existingAddendum = typeof shot?.notesAddendum === "string" ? shot.notesAddendum.trim() : "";

  const appendAddendum = useCallback(async () => {
    if (!clientId || !shot?.id) return;
    if (readOnly) return;
    const entry = addendumDraft.trim();
    if (!entry) return;

    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm");
    const author = user?.displayName || user?.email || "Unknown";
    const line = `[${timestamp}] ${author}: ${entry}`;
    const nextAddendum = existingAddendum ? `${existingAddendum}\n\n${line}` : line;

    setAddendumSaving(true);
    try {
      await updateShotWithVersion({
        clientId,
        shotId: shot.id,
        patch: { notesAddendum: nextAddendum },
        shot,
        user,
        source: "ShotNotesCanvas:addendum",
      });
      setAddendumDraft("");
      toast.success({ title: "Addendum added" });
    } catch (error) {
      toast.error({ title: "Failed to save addendum", description: error?.message });
    } finally {
      setAddendumSaving(false);
    }
  }, [addendumDraft, clientId, existingAddendum, readOnly, shot, user]);

  const canAppend = useMemo(() => {
    if (readOnly) return false;
    if (!clientId || !shot?.id) return false;
    return true;
  }, [clientId, readOnly, shot?.id]);

  return (
    <section className="space-y-6 rounded-lg" data-section="shot-notes">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Shot Notes
          </h2>
          {readOnly ? (
            <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-2xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
              <Eye className="w-3 h-3" />
              View only
            </span>
          ) : null}
        </div>
        <TrustIndicator lastSaved={lastSaved} lastEditedBy={lastEditedBy} />
      </div>

      <div className="min-h-[220px] rounded-xl border transition-colors overflow-hidden bg-slate-50/50 dark:bg-slate-700/20 border-slate-200/40 dark:border-slate-600/30 p-6">
        <NotesReadOnlyDisplay html={shot?.notes || ""} />
      </div>

      <div className="space-y-3" data-section="shot-notes-addendum">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Producer Addendum
          </h3>
          {readOnly ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              View only
            </span>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          {existingAddendum ? (
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {existingAddendum}
            </p>
          ) : (
            <span className="text-sm text-slate-400 dark:text-slate-500 italic">
              No addendum yet.
            </span>
          )}
        </div>

        {canAppend ? (
          <div className="space-y-2">
            <textarea
              value={addendumDraft}
              onChange={(e) => setAddendumDraft(e.target.value)}
              placeholder="Add a note (append-only)…"
              rows={3}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
            />
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={appendAddendum}
                disabled={addendumSaving || !addendumDraft.trim()}
                className="inline-flex items-center justify-center rounded-md bg-slate-900 text-white px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-100 dark:text-slate-900"
              >
                {addendumSaving ? "Saving…" : "Add addendum"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

