/**
 * ShotNotesCanvas - Primary authoring surface for shot notes with autosave
 *
 * DESIGN PHILOSOPHY
 * =================
 * This is the HERO surface of the page. It provides:
 * - Rich text editing via TipTap (bubble toolbar on text selection)
 * - Autosave with visible trust indicators ("Saving..." -> "Saved")
 * - Attribution display ("Last edited 5m ago by Ted")
 * - Read-only mode with proper HTML rendering
 *
 * PATTERNS REUSED
 * ===============
 * - Timestamp formatting: formatRelativeTime() from notifications.js
 * - Activity logging: createShotUpdatedActivity() from activityLogger.js
 * - User identity: {uid, displayName, photoURL} triplet pattern
 * - Audit fields: updatedAt, updatedBy patterns from common.js
 * - Rich text: RichTextEditor from components/shots
 * - Sanitization: sanitizeHtml from lib/sanitizeHtml.ts
 *
 * DATA MODEL
 * ==========
 * Canonical notes: shot.notes (sanitized HTML string, max 50000 chars)
 * Attribution: shot.notesUpdatedAt, shot.notesUpdatedBy (optional fields)
 * Versioning: shots/{shotId}/noteVersions subcollection (append-only)
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { doc, updateDoc, serverTimestamp, collection, addDoc, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { shotsPath, shotNoteVersionsPath } from "../../../lib/paths";
import { useAuth } from "../../../context/AuthContext";
import { formatRelativeTime } from "../../../lib/notifications";
import { logActivity, createShotUpdatedActivity } from "../../../lib/activityLogger";
import { sanitizeHtml, isEmptyHtml, normalizeHtmlContent } from "../../../lib/sanitizeHtml";
import RichTextEditor from "../RichTextEditor";
import { FileText, Eye, Check, Loader2, AlertCircle } from "lucide-react";

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTOSAVE_DEBOUNCE_MS = 1000; // Debounce for autosave
const VERSION_IDLE_MS = 12000; // Create version after 12s idle with changes
const MAX_NOTES_LENGTH = 50000; // Match schema constraint

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Simple hash function for content deduplication
 * Uses djb2 algorithm - fast and good distribution
 */
function hashContent(str) {
  if (!str) return "empty";
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// ============================================================================
// TRUST INDICATOR COMPONENT
// ============================================================================

function TrustIndicator({ status, lastSaved, lastEditedBy }) {
  // Status: 'idle' | 'saving' | 'saved' | 'error'
  const content = useMemo(() => {
    switch (status) {
      case "saving":
        return (
          <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Saving...</span>
          </span>
        );
      case "saved":
        return (
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500">
            <Check className="w-3 h-3" />
            <span>Saved</span>
          </span>
        );
      case "error":
        return (
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
            <AlertCircle className="w-3 h-3" />
            <span>Couldn&apos;t save</span>
          </span>
        );
      case "idle":
      default:
        // Show "Last edited X ago by Y" when idle
        if (lastSaved && lastEditedBy) {
          const timeAgo = formatRelativeTime(lastSaved);
          return (
            <span className="text-slate-400 dark:text-slate-500">
              Last edited {timeAgo} by {lastEditedBy}
            </span>
          );
        }
        if (lastSaved) {
          const timeAgo = formatRelativeTime(lastSaved);
          return (
            <span className="text-slate-400 dark:text-slate-500">
              Last edited {timeAgo}
            </span>
          );
        }
        return null;
    }
  }, [status, lastSaved, lastEditedBy]);

  if (!content) return null;

  return (
    <div className="text-xs transition-opacity duration-200">
      {content}
    </div>
  );
}

// ============================================================================
// READ-ONLY NOTES DISPLAY
// ============================================================================

function NotesReadOnlyDisplay({ html }) {
  const isEmpty = isEmptyHtml(html);

  if (isEmpty) {
    return (
      <span className="text-slate-400 dark:text-slate-500 italic">
        No notes added yet.
      </span>
    );
  }

  // Render sanitized HTML as rich text
  const sanitizedHtml = sanitizeHtml(html);

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ShotNotesCanvas({
  shot,
  readOnly = false,
}) {
  const auth = useAuth();
  const clientId = auth?.clientId;
  const user = auth?.user;

  // ══════════════════════════════════════════════════════════════════════════
  // LOCAL STATE
  // ══════════════════════════════════════════════════════════════════════════

  // Draft content (local edit state) - stores HTML
  const [draft, setDraft] = useState(() => shot?.notes || "");
  const [saveStatus, setSaveStatus] = useState("idle"); // 'idle' | 'saving' | 'saved' | 'error'

  // Track what we've persisted to avoid duplicate saves
  const lastPersistedRef = useRef(normalizeHtmlContent(shot?.notes));
  const lastVersionHashRef = useRef(null);

  // Prevent concurrent save operations (race condition mitigation)
  const saveInProgressRef = useRef(false);

  // Timers
  const saveTimerRef = useRef(null);
  const versionTimerRef = useRef(null);
  const savedIndicatorTimerRef = useRef(null);

  // ══════════════════════════════════════════════════════════════════════════
  // SYNC EXTERNAL CHANGES
  // ══════════════════════════════════════════════════════════════════════════

  // Sync draft with shot.notes when shot changes externally
  useEffect(() => {
    const serverContent = normalizeHtmlContent(shot?.notes);
    const currentDraft = normalizeHtmlContent(draft);

    // Only sync if server content differs and we're not in the middle of editing
    // (indicated by a pending save timer)
    if (serverContent !== currentDraft && !saveTimerRef.current) {
      setDraft(shot?.notes || "");
      lastPersistedRef.current = serverContent;
    }
  }, [shot?.notes, draft]);

  // ══════════════════════════════════════════════════════════════════════════
  // AUTOSAVE LOGIC
  // ══════════════════════════════════════════════════════════════════════════

  const saveNotes = useCallback(async (content) => {
    if (!clientId || !shot?.id || readOnly) return;

    // Prevent concurrent saves (race condition mitigation)
    if (saveInProgressRef.current) {
      return;
    }

    const normalized = normalizeHtmlContent(content);

    // Skip if content hasn't changed from last persisted value
    if (normalized === lastPersistedRef.current) {
      return;
    }

    saveInProgressRef.current = true;
    setSaveStatus("saving");

    try {
      const shotRef = doc(db, ...shotsPath(clientId), shot.id);

      // Prepare attribution data
      const updatePayload = {
        notes: normalized, // Store normalized (empty-safe) HTML
        notesUpdatedAt: serverTimestamp(),
        notesUpdatedBy: user ? {
          uid: user.uid,
          displayName: user.displayName || user.email || "Unknown",
          photoURL: user.photoURL || null,
        } : null,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(shotRef, updatePayload);

      // Update tracking
      lastPersistedRef.current = normalized;
      setSaveStatus("saved");

      // Clear saved indicator after 2s
      if (savedIndicatorTimerRef.current) {
        clearTimeout(savedIndicatorTimerRef.current);
      }
      savedIndicatorTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);

      // Log activity (non-blocking)
      if (shot.projectId) {
        logActivity(
          clientId,
          shot.projectId,
          createShotUpdatedActivity(
            user?.uid || "unknown",
            user?.displayName || "Unknown",
            user?.photoURL || null,
            shot.id,
            shot.name || "Untitled Shot",
            { notes: "updated" }
          )
        ).catch(() => {
          // Activity logging failures are non-critical
        });
      }
    } catch (error) {
      console.error("[ShotNotesCanvas] Save failed:", error);
      setSaveStatus("error");
    } finally {
      saveInProgressRef.current = false;
    }
  }, [clientId, shot?.id, shot?.projectId, shot?.name, user, readOnly]);

  // ══════════════════════════════════════════════════════════════════════════
  // VERSIONING LOGIC
  // ══════════════════════════════════════════════════════════════════════════

  const createVersion = useCallback(async (content) => {
    if (!clientId || !shot?.id || readOnly) return;

    const normalized = normalizeHtmlContent(content);
    if (!normalized) return; // Don't version empty content

    const contentHash = hashContent(normalized);

    // Skip if this exact content was already versioned
    if (contentHash === lastVersionHashRef.current) {
      return;
    }

    try {
      const versionsRef = collection(db, ...shotNoteVersionsPath(shot.id, clientId));

      // Check if this hash already exists (deduplication)
      const existingQuery = query(
        versionsRef,
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty) {
        const lastVersion = existingSnapshot.docs[0].data();
        if (lastVersion.contentHash === contentHash) {
          // Exact duplicate, skip
          lastVersionHashRef.current = contentHash;
          return;
        }
      }

      // Create new version
      await addDoc(versionsRef, {
        content: normalized,
        contentHash,
        createdAt: serverTimestamp(),
        createdBy: user ? {
          uid: user.uid,
          displayName: user.displayName || user.email || "Unknown",
          photoURL: user.photoURL || null,
        } : null,
        source: "shotEditorV3",
      });

      lastVersionHashRef.current = contentHash;
    } catch (error) {
      console.error("[ShotNotesCanvas] Version creation failed:", error);
      // Versioning failures are non-critical
    }
  }, [clientId, shot?.id, user, readOnly]);

  // ══════════════════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  const handleChange = useCallback((value) => {
    // RichTextEditor passes HTML string directly (not an event)
    // Enforce max length
    if (value && value.length > MAX_NOTES_LENGTH) {
      return;
    }

    setDraft(value);

    // Clear existing timers
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    if (versionTimerRef.current) {
      clearTimeout(versionTimerRef.current);
    }

    // Debounced autosave
    saveTimerRef.current = setTimeout(() => {
      saveNotes(value);
      saveTimerRef.current = null;
    }, AUTOSAVE_DEBOUNCE_MS);

    // Version creation after idle period
    versionTimerRef.current = setTimeout(() => {
      createVersion(value);
    }, VERSION_IDLE_MS);
  }, [saveNotes, createVersion]);

  // ══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (versionTimerRef.current) clearTimeout(versionTimerRef.current);
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
    };
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // DERIVED VALUES
  // ══════════════════════════════════════════════════════════════════════════

  const lastEditedBy = useMemo(() => {
    if (shot?.notesUpdatedBy?.displayName) {
      return shot.notesUpdatedBy.displayName;
    }
    return null;
  }, [shot?.notesUpdatedBy]);

  const lastSaved = shot?.notesUpdatedAt || null;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <section className="space-y-4">
      {/* Header row with title and trust indicator */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Shot Notes
          </h2>
          {/* Read-only indicator */}
          {readOnly && (
            <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
              <Eye className="w-3 h-3" />
              View only
            </span>
          )}
        </div>

        {/* Trust indicator */}
        {!readOnly && (
          <TrustIndicator
            status={saveStatus}
            lastSaved={lastSaved}
            lastEditedBy={lastEditedBy}
          />
        )}

        {/* Read-only attribution */}
        {readOnly && lastSaved && (
          <TrustIndicator
            status="idle"
            lastSaved={lastSaved}
            lastEditedBy={lastEditedBy}
          />
        )}
      </div>

      {/* Notes canvas — Primary thinking surface with intentional framing */}
      <div
        className={`
          min-h-[220px] rounded-xl border transition-colors overflow-hidden
          ${readOnly
            ? "bg-slate-50/50 dark:bg-slate-700/20 border-slate-200/40 dark:border-slate-600/30 p-6"
            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm ring-1 ring-inset ring-slate-100 dark:ring-slate-700/50"
          }
        `}
      >
        {readOnly ? (
          // Read-only display with proper HTML rendering
          <NotesReadOnlyDisplay html={draft} />
        ) : (
          // Rich text editor with visible toolbar (primary thinking surface per design-spec.md)
          <RichTextEditor
            value={draft}
            onChange={handleChange}
            disabled={false}
            placeholder="Write your shot notes here...

Describe the purpose, concept, and creative direction for this shot."
            characterLimit={MAX_NOTES_LENGTH}
            minHeight="180px"
            maxHeight="600px"
            hideToolbar={false}
            hideBubble={false}
            className="shot-notes-editor"
          />
        )}
      </div>
    </section>
  );
}
