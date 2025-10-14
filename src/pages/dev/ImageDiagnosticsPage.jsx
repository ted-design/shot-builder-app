import { useCallback, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  getActiveProjectId,
  shotsPath,
  productFamiliesPath,
  talentPath,
  locationsPath,
} from "../../lib/paths";
import { resolveImageSourceToDataUrl } from "../../lib/pdfImageCollector";
import { Button } from "../../components/ui/button";

const SAMPLE_LIMIT = 8;

const flattenCandidates = (value, collector) => {
  if (!value) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) return;
    const isLikelyImage = /\.(jpe?g|png|webp|gif|bmp)(\?.*)?$/i.test(trimmed) || /\/images?\//i.test(trimmed);
    if (isLikelyImage || /^https?:\/\//i.test(trimmed)) {
      collector.add(trimmed);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => flattenCandidates(entry, collector));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((entry) => flattenCandidates(entry, collector));
  }
};

const buildCollectionConfig = (projectId) => [
  {
    key: "shots",
    label: "Shots",
    query: query(collection(db, ...shotsPath()), where("projectId", "==", projectId), limit(SAMPLE_LIMIT)),
  },
  {
    key: "productFamilies",
    label: "Product families",
    query: query(collection(db, ...productFamiliesPath()), limit(SAMPLE_LIMIT)),
  },
  {
    key: "talent",
    label: "Talent",
    query: query(collection(db, ...talentPath()), limit(SAMPLE_LIMIT)),
  },
  {
    key: "locations",
    label: "Locations",
    query: query(collection(db, ...locationsPath()), limit(SAMPLE_LIMIT)),
  },
];

const initialState = {
  running: false,
  collections: [],
  error: null,
  durationMs: null,
};

const formatDuration = (ms) => `${(ms / 1000).toFixed(1)}s`;

export default function ImageDiagnosticsPage() {
  const [state, setState] = useState(initialState);
  const isDev = useMemo(() => import.meta.env.DEV, []);

  const runDiagnostics = useCallback(async () => {
    if (!isDev) {
      return;
    }
    setState((prev) => ({ ...prev, running: true, error: null, collections: [], durationMs: null }));
    const startedAt = performance.now();
    const projectId = getActiveProjectId();
    const config = buildCollectionConfig(projectId);
    const results = [];

    try {
      for (const entry of config) {
        const snapshot = await getDocs(entry.query);
        const docs = [];
        for (const doc of snapshot.docs) {
          const data = doc.data();
          const candidates = new Set();
          flattenCandidates(data, candidates);
          const sample = Array.from(candidates).slice(0, 3);
          const checks = [];
          for (const candidate of sample) {
            const startedCandidate = performance.now();
            try {
              const { resolvedUrl } = await resolveImageSourceToDataUrl(candidate);
              const duration = performance.now() - startedCandidate;
              checks.push({
                source: candidate,
                resolvedUrl,
                ok: true,
                duration,
              });
            } catch (error) {
              checks.push({
                source: candidate,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
          docs.push({ id: doc.id, checks });
        }
        const okCount = docs.reduce(
          (count, doc) => count + doc.checks.filter((check) => check.ok).length,
          0
        );
        const failCount = docs.reduce(
          (count, doc) => count + doc.checks.filter((check) => !check.ok).length,
          0
        );
        results.push({
          key: entry.key,
          label: entry.label,
          okCount,
          failCount,
          docs,
        });
      }
      const finishedAt = performance.now();
      setState({ running: false, collections: results, error: null, durationMs: finishedAt - startedAt });
    } catch (error) {
      setState({ running: false, collections: [], error: error instanceof Error ? error.message : String(error), durationMs: null });
    }
  }, [isDev]);

  if (!isDev) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Image diagnostics</h1>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">This utility is only available in development builds.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Image diagnostics</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Samples up to {SAMPLE_LIMIT} documents from shots, product families, talent, and locations. Each candidate
          image is resolved via the active storage adapter and fetched with CORS enabled. Failures surface below to
          help debug signed URL or CORS issues.
        </p>
        <Button type="button" onClick={runDiagnostics} disabled={state.running}>
          {state.running ? "Checking…" : "Run diagnostics"}
        </Button>
        {state.durationMs != null ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Completed in {formatDuration(state.durationMs)}</p>
        ) : null}
      </div>
      {state.error ? (
        <div className="rounded border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 p-4 text-sm text-rose-700 dark:text-rose-300">
          Failed to run diagnostics: {state.error}
        </div>
      ) : null}
      {state.collections.map((collection) => (
        <div key={collection.key} className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{collection.label}</h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {collection.okCount} passed • {collection.failCount} failed
            </span>
          </div>
          <div className="space-y-3">
            {collection.docs.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No documents sampled.</p>
            ) : (
              collection.docs.map((doc) => (
                <div key={doc.id} className="rounded border border-slate-100 dark:border-slate-700 p-3">
                  <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">{doc.id}</div>
                  {doc.checks.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">No image-like fields found.</div>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {doc.checks.map((check, index) => (
                        <li
                          key={`${doc.id}-${index}`}
                          className={`rounded border px-2 py-1 ${
                            check.ok
                              ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                              : "border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          <div className="font-mono text-[11px]">
                            {check.source}
                          </div>
                          {check.ok ? (
                            <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                              Resolved in {formatDuration(check.duration)} via {check.resolvedUrl}
                            </div>
                          ) : (
                            <div className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">{check.error}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
