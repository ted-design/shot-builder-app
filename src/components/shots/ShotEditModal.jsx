import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Modal } from "../ui/modal";
import { Card, CardHeader, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import RichTextEditor from "./RichTextEditor";
import ShotProductsEditor from "./ShotProductsEditor";
import TalentMultiSelect from "./TalentMultiSelect";
import LocationSelect from "./LocationSelect";
import TagEditor from "./TagEditor";
import CommentSection from "../comments/CommentSection";
import ImageCropPositionEditor from "../common/ImageCropPositionEditor";
import { useAuth } from "../../context/AuthContext";
import ShotSidebarSummary from "./ShotSidebarSummary";
import SingleImageDropzone from "../common/SingleImageDropzone";
import AppImage from "../common/AppImage";

const steps = [
  { id: "basics", label: "Basics", description: "Core identifiers" },
  { id: "logistics", label: "Logistics", description: "Resources & tags" },
  { id: "creative", label: "Creative", description: "Notes & direction" },
  { id: "attachments", label: "Attachments", description: "Reference imagery" },
];

export default function ShotEditModal({
  open,
  titleId = "shot-edit-modal-title",
  heading,
  shotName,
  description = "Update shot details, linked products, and talent assignments.",
  draft,
  onChange,
  onClose,
  onSubmit,
  isSaving = false,
  submitLabel = "Save changes",
  savingLabel = "Saving…",
  onDelete,
  families = [],
  loadFamilyDetails,
  createProduct,
  allowProductCreation = false,
  onCreateProduct,
  onCreateColourway,
  locations = [],
  talentOptions = [],
  talentPlaceholder = "Select talent",
  talentNoOptionsMessage = "No talent available",
  talentLoadError = null,
  projects = [],
  currentProjectId = null,
  onMoveToProject,
  movingProject = false,
  onCopyToProject,
  copyingProject = false,
  shotId = null,
  autoSaveStatus = null,
}) {
  const { clientId } = useAuth();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [showNameError, setShowNameError] = useState(false);
  const tabRefs = useRef([]);

  useEffect(() => {
    if (!open) return;
    setActiveStep(0);
    setShowNameError(false);
  }, [open, draft?.id]);

  useEffect(() => {
    if (draft?.name?.trim()) {
      setShowNameError(false);
    }
  }, [draft?.name]);

  const handleFieldChange = (patch) => {
    if (typeof onChange === "function") {
      onChange(patch);
    }
  };

  const navigationDisabled = isSaving || deleting;

  const locationLabel = useMemo(() => {
    if (!draft?.locationId) return "No location";
    const match = locations.find((entry) => entry.id === draft.locationId);
    return match?.name || "Unknown location";
  }, [draft?.locationId, locations]);

  if (!open || !draft) {
    return null;
  }

  const handleStatusChange = (nextStatus) => {
    handleFieldChange({ status: nextStatus });
  };

  const focusTab = (index) => {
    const nextIndex = (index + steps.length) % steps.length;
    setActiveStep(nextIndex);
    requestAnimationFrame(() => {
      tabRefs.current[nextIndex]?.focus?.();
    });
  };

  const handleTabKeyDown = (event, index) => {
    if (navigationDisabled) return;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusTab(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusTab(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusTab(0);
        break;
      case "End":
        event.preventDefault();
        focusTab(steps.length - 1);
        break;
      default:
        break;
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!draft.name || !draft.name.trim()) {
      setShowNameError(true);
      setActiveStep(0);
      return;
    }
    if (typeof onSubmit === "function") {
      onSubmit();
    }
  };

  const talentMessage = typeof talentNoOptionsMessage === "function"
    ? talentNoOptionsMessage
    : () => talentNoOptionsMessage;

  const uniquePrefix = titleId || "shot-edit";
  const modalHeading = heading || (shotName ? `Edit ${shotName}` : "Edit shot");

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} contentClassName="p-0 max-h-[90vh] overflow-y-auto">
      <Card className="border-0 shadow-none">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 id={titleId} className="text-lg font-semibold">
                {modalHeading}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
            </div>
            <div className="flex items-center gap-2">
              {onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setConfirmingDelete((value) => !value);
                    setDeleteText("");
                  }}
                  disabled={isSaving || deleting}
                >
                  Delete
                </Button>
              )}
              <button
                type="button"
                aria-label="Close"
                className="text-xl text-slate-500 transition hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
                onClick={onClose}
              >
                ×
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {confirmingDelete && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="mb-2 text-sm text-red-700 dark:text-red-400">
                This will permanently remove this shot and cannot be undone. To confirm, type "DELETE" below and press Permanently delete.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={deleteText}
                  onChange={(event) => setDeleteText(event.target.value)}
                  placeholder="Type DELETE to confirm"
                  disabled={isSaving || deleting}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeleteText("");
                  }}
                  disabled={isSaving || deleting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={async () => {
                    if (!onDelete) return;
                    if (deleteText.trim() !== "DELETE") return;
                    try {
                      setDeleting(true);
                      await onDelete();
                      onClose?.();
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  disabled={deleteText.trim() !== "DELETE" || isSaving || deleting}
                >
                  {deleting ? "Deleting…" : "Permanently delete"}
                </Button>
              </div>
            </div>
          )}

          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <nav
              aria-label="Shot sections"
              className="rounded-card border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <ol
                className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                role="tablist"
                aria-orientation="horizontal"
              >
                {steps.map((step, index) => {
                  const isCurrent = index === activeStep;
                  const baseClasses = "w-full rounded-md border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
                  const stateClasses = isCurrent
                    ? "border-primary bg-primary/10 text-primary dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-300"
                    : "border-slate-200 text-slate-700 hover:border-primary/60 hover:bg-primary/5 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-500";
                  const stepStatus = autoSaveStatus?.[step.id] || null;
                  let statusText = "";
                  let statusTone = "text-slate-400 dark:text-slate-500";
                  if (stepStatus) {
                    switch (stepStatus.state) {
                      case "pending":
                        statusText = "Unsaved changes";
                        statusTone = "text-amber-600 dark:text-amber-400";
                        break;
                      case "saving":
                        statusText = "Saving…";
                        statusTone = "text-primary dark:text-indigo-400 animate-pulse";
                        break;
                      case "saved": {
                        if (stepStatus.timestamp) {
                          const timestampDate = new Date(stepStatus.timestamp);
                          statusText = `Saved ${formatDistanceToNow(timestampDate, { addSuffix: true })}`;
                        } else {
                          statusText = "Saved";
                        }
                        statusTone = "text-emerald-600 dark:text-emerald-400";
                        break;
                      }
                      case "error":
                        statusText = stepStatus.message || "Auto-save failed";
                        statusTone = "text-red-600 dark:text-red-400";
                        break;
                      default:
                        break;
                    }
                  }
                  return (
                    <li key={step.id}>
                      <button
                        type="button"
                        role="tab"
                        id={`${uniquePrefix}-${step.id}-tab`}
                        aria-controls={`${uniquePrefix}-${step.id}-panel`}
                        aria-selected={isCurrent}
                        aria-label={step.label}
                        tabIndex={isCurrent ? 0 : -1}
                        ref={(element) => {
                          tabRefs.current[index] = element;
                        }}
                        onClick={() => {
                          if (navigationDisabled) return;
                          setActiveStep(index);
                        }}
                        onKeyDown={(event) => handleTabKeyDown(event, index)}
                        disabled={navigationDisabled}
                        className={`${baseClasses} ${stateClasses}`.trim()}
                      >
                        <span className="mt-1 block text-sm font-medium">{step.label}</span>
                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{step.description}</span>
                        {statusText && (
                          <span className={`mt-1 block text-xs ${statusTone}`}>
                            {statusText}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>

            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <section
                  id={`${uniquePrefix}-basics-panel`}
                  role="tabpanel"
                  aria-labelledby={`${uniquePrefix}-basics-tab`}
                  hidden={activeStep !== 0}
                  className="space-y-4"
                >
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Basics</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Capture the key identifiers and schedule details so the shot shows up in the right place.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor={`${uniquePrefix}-name`}>
                        Name
                      </label>
                      <Input
                        id={`${uniquePrefix}-name`}
                        value={draft.name}
                        onChange={(event) => handleFieldChange({ name: event.target.value })}
                        required
                        disabled={navigationDisabled}
                      />
                      {showNameError && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          Add a name before saving.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor={`${uniquePrefix}-type`}>
                        Type
                      </label>
                      <Input
                        id={`${uniquePrefix}-type`}
                        value={draft.type}
                        onChange={(event) => handleFieldChange({ type: event.target.value })}
                        disabled={navigationDisabled}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor={`${uniquePrefix}-date`}>
                        Date
                      </label>
                      <Input
                        id={`${uniquePrefix}-date`}
                        type="date"
                        value={draft.date || ""}
                        onChange={(event) => handleFieldChange({ date: event.target.value })}
                        disabled={navigationDisabled}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor={`${uniquePrefix}-location`}>
                        Location
                      </label>
                      <LocationSelect
                        options={locations}
                        value={draft.locationId || ""}
                        onChange={(id) => handleFieldChange({ locationId: id || "" })}
                        isDisabled={navigationDisabled}
                      />
                    </div>
                  </div>
                </section>

                <section
                  id={`${uniquePrefix}-logistics-panel`}
                  role="tabpanel"
                  aria-labelledby={`${uniquePrefix}-logistics-tab`}
                  hidden={activeStep !== 1}
                  className="space-y-5"
                >
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Logistics</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Link the products, people, and tags so departments know what they own.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Products</label>
                    <ShotProductsEditor
                      value={draft.products}
                      onChange={(next) => handleFieldChange({ products: next })}
                      families={families}
                      loadFamilyDetails={loadFamilyDetails}
                      createProduct={createProduct}
                      canCreateProduct={allowProductCreation}
                      onCreateProduct={allowProductCreation ? onCreateProduct : undefined}
                      onCreateColourway={allowProductCreation ? onCreateColourway : undefined}
                      emptyHint="No products linked"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Talent</label>
                    <TalentMultiSelect
                      options={talentOptions}
                      value={draft.talent}
                      onChange={(next) => handleFieldChange({ talent: next })}
                      isDisabled={navigationDisabled}
                      placeholder={talentLoadError ? "Talent unavailable" : talentPlaceholder}
                      noOptionsMessage={talentMessage}
                    />
                    {talentLoadError && (
                      <p className="text-xs text-red-600 dark:text-red-400">{talentLoadError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <TagEditor
                      tags={draft.tags || []}
                      onChange={(next) => handleFieldChange({ tags: next })}
                      clientId={clientId}
                      projectId={currentProjectId}
                    />
                  </div>
                  {onMoveToProject && projects.length > 0 && (
                    <div className="rounded-card border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400">Move to another project</h4>
                          <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">
                            Transfer this shot to a different project. The shot will be removed from this project's planner.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="flex-1 rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500"
                            disabled={navigationDisabled || movingProject || copyingProject}
                            onChange={(event) => {
                              const targetProjectId = event.target.value;
                              if (targetProjectId && targetProjectId !== currentProjectId) {
                                onMoveToProject(targetProjectId);
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="">Select a project...</option>
                            {projects
                              .filter((project) => project.id !== currentProjectId && project.status !== "archived")
                              .map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                  {onCopyToProject && projects.length > 0 && (
                    <div className="rounded-card border border-green-200 bg-green-50/70 p-4 dark:border-green-800 dark:bg-green-900/20">
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-semibold text-green-700 dark:text-green-400">Copy to another project</h4>
                          <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                            Create a duplicate of this shot in a different project. The original shot will remain in this project.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="flex-1 rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500"
                            disabled={navigationDisabled || movingProject || copyingProject}
                            onChange={(event) => {
                              const targetProjectId = event.target.value;
                              if (targetProjectId && targetProjectId !== currentProjectId) {
                                onCopyToProject(targetProjectId);
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="">Select a project...</option>
                            {projects
                              .filter((project) => project.id !== currentProjectId && project.status !== "archived")
                              .map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <section
                  id={`${uniquePrefix}-creative-panel`}
                  role="tabpanel"
                  aria-labelledby={`${uniquePrefix}-creative-tab`}
                  hidden={activeStep !== 2}
                  className="space-y-4"
                >
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Creative Direction</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Outline the intent, framing, and creative notes so everyone aligns before set.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
                    <RichTextEditor
                      value={draft.description}
                      onChange={(next) => handleFieldChange({ description: next })}
                      disabled={navigationDisabled}
                      placeholder="Add detailed notes with rich formatting, @mentions, links, and more…"
                      characterLimit={50000}
                    />
                  </div>
                </section>

                <section
                  id={`${uniquePrefix}-attachments-panel`}
                  role="tabpanel"
                  aria-labelledby={`${uniquePrefix}-attachments-tab`}
                  hidden={activeStep !== 3}
                  className="space-y-4"
                >
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Attachments</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Upload storyboard frames or reference imagery and fine-tune the crop for planner previews.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Reference Image
                      <span className="ml-2 text-xs font-normal text-slate-500">(optional)</span>
                    </label>
                    <SingleImageDropzone
                      value={draft.referenceImageFile || null}
                      onChange={(file) => handleFieldChange({ referenceImageFile: file })}
                      disabled={navigationDisabled}
                      existingImageUrl={draft.referenceImagePath || null}
                      onRemoveExisting={() => handleFieldChange({ referenceImagePath: "", referenceImageFile: null, referenceImageCrop: null })}
                      showPreview={false}
                    />
                    {draft.referenceImagePath && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 rounded-md bg-slate-50 p-2 dark:bg-slate-800">
                          <div className="h-20 w-20 overflow-hidden rounded bg-slate-100">
                            <AppImage
                              src={draft.referenceImagePath}
                              alt="Reference"
                              className="h-20 w-20"
                              imageClassName="h-full w-full object-cover"
                              placeholder={
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                                  Loading…
                                </div>
                              }
                              fallback={
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                                  No image
                                </div>
                              }
                            />
                          </div>
                        </div>
                        <ImageCropPositionEditor
                          imageSrc={draft.referenceImagePath}
                          cropPosition={draft.referenceImageCrop || { x: 50, y: 50 }}
                          onCropChange={(position) => handleFieldChange({ referenceImageCrop: position })}
                        />
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <ShotSidebarSummary
                status={draft.status}
                onStatusChange={handleStatusChange}
                statusDisabled={navigationDisabled}
                dateValue={draft.date}
                locationLabel={locationLabel}
                tags={draft.tags || []}
                basicsStatus={autoSaveStatus?.basics || null}
                logisticsStatus={autoSaveStatus?.logistics || null}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
              <Button type="button" variant="ghost" onClick={onClose} disabled={navigationDisabled}>
                Cancel
              </Button>
              <Button type="submit" disabled={navigationDisabled}>
                {isSaving ? savingLabel : submitLabel}
              </Button>
            </div>
          </form>

          {shotId && clientId && (
            <>
              <div className="border-t border-slate-200 dark:border-slate-700" />
              <CommentSection clientId={clientId} shotId={shotId} shotName={shotName || draft?.name} />
            </>
          )}
        </CardContent>
      </Card>
    </Modal>
  );
}
