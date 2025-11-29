import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Modal } from "../ui/modal";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import Thumb from "../Thumb";
import AppImage from "../common/AppImage";
import { formatNotesForDisplay } from "../../lib/sanitize";
import { db } from "../../lib/firebase";
import { MEASUREMENT_LABEL_MAP, orderMeasurementKeys } from "./measurementOptions";

const formatContactLine = (talent) => {
  const parts = [talent?.phone, talent?.email].filter(Boolean);
  return parts.join(" • ");
};

const normaliseGallery = (images = []) =>
  (Array.isArray(images) ? images : [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((item, index) => ({ ...item, order: item.order ?? index }));

const cropStyle = (cropData) => {
  if (!cropData) return undefined;
  const { x = 0, y = 0, zoom = 1, rotation = 0 } = cropData;
  return {
    transform: `translate(-${x}%, -${y}%) scale(${zoom}) rotate(${rotation}deg)`,
    transformOrigin: "center",
  };
};

const formatStatus = (status) => {
  const value = status || "todo";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export default function TalentDetailModal({ open, talent, onClose, onEdit, canEdit = false, clientId }) {
  const displayName = talent?.name || `${talent?.firstName || ""} ${talent?.lastName || ""}`.trim() || "Talent";
  const contactLine = formatContactLine(talent);
  const notesHtml = useMemo(() => formatNotesForDisplay(talent?.notes || talent?.sizing || ""), [talent]);
  const measurementKeys = useMemo(
    () => orderMeasurementKeys(talent?.measurements || {}, talent?.gender),
    [talent]
  );
  const galleryImages = useMemo(() => normaliseGallery(talent?.galleryImages || []), [talent]);

  const [shotsState, setShotsState] = useState({ loading: false, shots: [], error: null });

  useEffect(() => {
    if (!open || !talent?.id || !clientId) return;
    let cancelled = false;
    const fetchShots = async () => {
      setShotsState({ loading: true, shots: [], error: null });
      try {
        const shotsRef = collection(db, "clients", clientId, "shots");
        const snapshot = await getDocs(query(shotsRef, where("talentIds", "array-contains", talent.id)));
        if (cancelled) return;
        const shots = snapshot.docs
          .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
          .filter((shot) => !shot.deleted);
        shots.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        setShotsState({ loading: false, shots, error: null });
      } catch (error) {
        if (cancelled) return;
        setShotsState({ loading: false, shots: [], error: error?.message || "Unable to load shots" });
      }
    };

    fetchShots();
    return () => {
      cancelled = true;
    };
  }, [open, talent?.id, clientId]);

  if (!talent) return null;

  const statusCounts = shotsState.shots.reduce((acc, shot) => {
    const key = shot.status || "todo";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="talent-detail-title"
      contentClassName="p-0 max-h-[90vh] overflow-y-auto"
    >
      <Card className="border-0 shadow-none">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="talent-detail-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {displayName}
              </h2>
              {talent?.agency && (
                <p className="text-sm text-slate-600 dark:text-slate-400">{talent.agency}</p>
              )}
              {contactLine && <p className="text-sm text-slate-500 dark:text-slate-400">{contactLine}</p>}
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button type="button" size="sm" onClick={() => onEdit?.(talent)}>
                  Edit
                </Button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                ×
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-card bg-slate-100 dark:bg-slate-800">
                <Thumb
                  path={talent.headshotPath || null}
                  size={640}
                  alt={displayName}
                  className="aspect-[4/5] w-full"
                  imageClassName="h-full w-full object-cover"
                  fallback={
                    <div className="flex h-full w-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                      No headshot
                    </div>
                  }
                />
              </div>

              <div className="rounded-card border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <span>Details</span>
                  {talent.gender && <span className="text-xs uppercase text-slate-500 dark:text-slate-400">{talent.gender}</span>}
                </div>
                <dl className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {talent.phone && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Phone</dt>
                      <dd className="text-right">{talent.phone}</dd>
                    </div>
                  )}
                  {talent.email && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Email</dt>
                      <dd className="text-right break-all">{talent.email}</dd>
                    </div>
                  )}
                  {talent.url && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Portfolio</dt>
                      <dd className="text-right">
                        <a href={talent.url} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
                          {talent.url}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="rounded-card border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Measurements</div>
                {measurementKeys.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No measurements recorded.</p>
                ) : (
                  <dl className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                    {measurementKeys.map((key) => (
                      <div key={key} className="flex justify-between gap-3">
                        <dt className="text-slate-500">{MEASUREMENT_LABEL_MAP[key] || key}</dt>
                        <dd className="text-right">{talent.measurements?.[key]}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <section className="rounded-card border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notes</h3>
                {notesHtml ? (
                  <div
                    className="prose prose-sm mt-2 max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: notesHtml }}
                  />
                ) : (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No notes yet.</p>
                )}
              </section>

              <section className="rounded-card border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Additional images</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{galleryImages.length} file{galleryImages.length === 1 ? "" : "s"}</span>
                </div>
                {galleryImages.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No additional images.</p>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {galleryImages.map((image) => (
                      <div key={image.id} className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                        <AppImage
                          src={image.downloadURL || image.path}
                          alt={image.description || displayName}
                          preferredSize={720}
                          className="aspect-[4/5] w-full bg-slate-100 dark:bg-slate-800"
                          imageClassName="h-full w-full object-cover"
                          imageStyle={cropStyle(image.cropData)}
                          fallback={
                            <div className="flex h-full w-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                              Image unavailable
                            </div>
                          }
                        />
                        {image.description ? (
                          <p className="border-t border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
                            {image.description}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-card border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Linked shots</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{shotsState.shots.length}</span>
                </div>
                {shotsState.loading ? (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading shots…</p>
                ) : shotsState.error ? (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{shotsState.error}</p>
                ) : shotsState.shots.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No shots linked to this talent.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {Object.keys(statusCounts).length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                        {Object.entries(statusCounts).map(([status, count]) => (
                          <span
                            key={status}
                            className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800"
                            title={`${count} ${formatStatus(status)} shot${count === 1 ? "" : "s"}`}
                          >
                            {formatStatus(status)}: {count}
                          </span>
                        ))}
                      </div>
                    )}
                    <ul className="space-y-2">
                      {shotsState.shots.slice(0, 5).map((shot) => (
                        <li
                          key={shot.id}
                          className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{shot.name || "Untitled shot"}</p>
                            {shot.date && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">{shot.date}</p>
                            )}
                          </div>
                          <span className="text-xs text-slate-600 dark:text-slate-300">{formatStatus(shot.status)}</span>
                        </li>
                      ))}
                    </ul>
                    {shotsState.shots.length > 5 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">+ {shotsState.shots.length - 5} more linked shot{shotsState.shots.length - 5 === 1 ? "" : "s"}</p>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
