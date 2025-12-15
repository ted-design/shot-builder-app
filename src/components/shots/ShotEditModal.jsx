import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";
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
import SingleImageDropzone from "../common/SingleImageDropzone";
import AppImage from "../common/AppImage";
import MultiImageAttachmentManager from "./MultiImageAttachmentManager";
import AdvancedImageCropEditor from "./AdvancedImageCropEditor";
import { VersionHistoryPanel, ActiveEditorsBar } from "../versioning";

const steps = [
  { id: "basics", label: "Basics", description: "Core details & references" },
  { id: "creative-logistics", label: "Creative and Logistics", description: "Resources, tags & direction" },
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
  const { clientId, user } = useAuth();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [showNameError, setShowNameError] = useState(false);
  const [cropEditorOpen, setCropEditorOpen] = useState(false);
  const [editingAttachment, setEditingAttachment] = useState(null);
  const [advancedActionsOpen, setAdvancedActionsOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
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

  const handleEditAttachment = (attachment) => {
    setEditingAttachment(attachment);
    setCropEditorOpen(true);
  };

  const handleSaveCrop = (cropData) => {
    if (!editingAttachment) return;

    // Update the attachment with new cropData
    const updatedAttachments = (draft.attachments || []).map((att) =>
      att.id === editingAttachment.id ? { ...att, cropData } : att
    );

    handleFieldChange({ attachments: updatedAttachments });
  };

  const handleCloseCropEditor = () => {
    setCropEditorOpen(false);
    setEditingAttachment(null);
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
              {/* History button - only show for existing shots */}
              {shotId && clientId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setHistoryPanelOpen(true)}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <History className="h-4 w-4 mr-1" />
                  History
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

          {/* Active editors bar - shows who else is editing */}
          {shotId && clientId && (
            <ActiveEditorsBar
              clientId={clientId}
              entityType="shots"
              entityId={shotId}
              enabled={open}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <nav
              aria-label="Shot sections"
              className="rounded-card border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <ol
                className="grid gap-2 sm:grid-cols-2"
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
                      Core shot details, scheduling, and reference imagery.
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
                      <label
                        className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                        htmlFor={`${uniquePrefix}-shot-number`}
                      >
                        Shot Number
                      </label>
                      <Input
                        id={`${uniquePrefix}-shot-number`}
                        value={draft.shotNumber || ""}
                        onChange={(event) => handleFieldChange({ shotNumber: event.target.value })}
                        placeholder="e.g., 12A"
                        disabled={navigationDisabled}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor={`${uniquePrefix}-status`}>
                        Status
                      </label>
                      <select
                        id={`${uniquePrefix}-status`}
                        value={draft.status || "todo"}
                        onChange={(event) => handleFieldChange({ status: event.target.value })}
                        disabled={navigationDisabled}
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:ring-offset-slate-900 dark:placeholder:text-slate-400 dark:focus:ring-indigo-500"
                      >
                        <option value="todo">Todo</option>
                        <option value="in_progress">In Progress</option>
                        <option value="complete">Complete</option>
                        <option value="on_hold">On Hold</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor={`${uniquePrefix}-description-field`}>
                        Description
                      </label>
                      <Input
                        id={`${uniquePrefix}-description-field`}
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
                    <div className="sm:col-span-2">
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
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Reference Images
                      <span className="ml-2 text-xs font-normal text-slate-500">(up to 10)</span>
                    </label>
                    <MultiImageAttachmentManager
                      attachments={draft.attachments || []}
                      onChange={(attachments) => handleFieldChange({ attachments })}
                      disabled={navigationDisabled}
                      userId={user?.uid}
                      clientId={clientId}
                      shotId={shotId || draft.id || "temp"}
                      onEditAttachment={handleEditAttachment}
                    />
                  </div>
                </section>

                <section
                  id={`${uniquePrefix}-creative-logistics-panel`}
                  role="tabpanel"
                  aria-labelledby={`${uniquePrefix}-creative-logistics-tab`}
                  hidden={activeStep !== 1}
                  className="space-y-5"
                >
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Creative and Logistics</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Define creative direction, link products and talent, and organize with tags.
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
                </section>
            </div>

            {/* Advanced Actions Section (Edit mode only) */}
            {shotId && (onMoveToProject || onCopyToProject || onDelete) && (
              <div className="rounded-card border border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/30">
                <button
                  type="button"
                  onClick={() => setAdvancedActionsOpen(!advancedActionsOpen)}
                  disabled={navigationDisabled}
                  className="flex w-full items-center justify-between p-4 text-left transition hover:bg-slate-100/50 dark:hover:bg-slate-700/30"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Advanced Actions</h4>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Move, copy, or delete this shot
                    </p>
                  </div>
                  <svg
                    className={`h-5 w-5 text-slate-500 transition-transform dark:text-slate-400 ${advancedActionsOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {advancedActionsOpen && (
                  <div className="space-y-4 border-t border-slate-200 p-4 dark:border-slate-700">
                    {/* Move to another project */}
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

                    {/* Copy to another project */}
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

                    {/* Delete shot */}
                    {onDelete && (
                      <div className="rounded-card border border-red-200 bg-red-50/70 p-4 dark:border-red-800 dark:bg-red-900/20">
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Delete shot</h4>
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                              Permanently remove this shot. This action cannot be undone.
                            </p>
                          </div>
                          {!confirmingDelete ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setConfirmingDelete(true);
                                setDeleteText("");
                              }}
                              disabled={navigationDisabled}
                            >
                              Delete shot
                            </Button>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-sm text-red-700 dark:text-red-400">
                                To confirm deletion, type "DELETE" below:
                              </p>
                              <Input
                                value={deleteText}
                                onChange={(event) => setDeleteText(event.target.value)}
                                placeholder="Type DELETE to confirm"
                                disabled={navigationDisabled || deleting}
                              />
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setConfirmingDelete(false);
                                    setDeleteText("");
                                  }}
                                  disabled={navigationDisabled || deleting}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
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
                                  disabled={deleteText.trim() !== "DELETE" || navigationDisabled || deleting}
                                >
                                  {deleting ? "Deleting…" : "Permanently delete"}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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

      {/* Crop Editor Modal */}
      <AdvancedImageCropEditor
        open={cropEditorOpen}
        onClose={handleCloseCropEditor}
        attachment={editingAttachment}
        onSave={handleSaveCrop}
      />

      {/* Version History Panel */}
      {shotId && clientId && (
        <VersionHistoryPanel
          open={historyPanelOpen}
          onClose={() => setHistoryPanelOpen(false)}
          clientId={clientId}
          entityType="shots"
          entityId={shotId}
          entityName={shotName || draft?.name}
        />
      )}
    </Modal>
  );
}
