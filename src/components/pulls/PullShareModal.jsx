// src/components/pulls/PullShareModal.jsx
//
// Modal for generating and managing shareable links for pulls

import React, { useState } from "react";
import { Modal } from "../ui/modal";
import { Card, CardHeader, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { generateShareToken, getShareableURL, copyShareURLToClipboard } from "../../lib/pullSharing";
import { toast, showConfirm } from "../../lib/toast";
import { Copy, ExternalLink, X } from "lucide-react";

export default function PullShareModal({
  pull,
  onGenerateLink,
  onRevokeLink,
  onClose,
}) {
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const isShared = pull.shareEnabled && pull.shareToken;
  const shareURL = isShared ? getShareableURL(pull.shareToken) : "";

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const token = generateShareToken();
      await onGenerateLink(token);
      toast.success({ title: "Share link generated" });
    } catch (error) {
      console.error("[PullShareModal] Failed to generate link", error);
      toast.error({ title: "Failed to generate link" });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await copyShareURLToClipboard(pull.shareToken);
      toast.success({ title: "Link copied to clipboard" });
    } catch (error) {
      console.error("[PullShareModal] Failed to copy", error);
      toast.error({ title: "Failed to copy link" });
    }
  };

  const handleRevoke = async () => {
    const confirmed = await showConfirm("Revoke this share link? Anyone with the link will lose access.");
    if (!confirmed) {
      return;
    }

    setRevoking(true);
    try {
      await onRevokeLink();
      toast.success({ title: "Share link revoked" });
    } catch (error) {
      console.error("[PullShareModal] Failed to revoke link", error);
      toast.error({ title: "Failed to revoke link" });
    } finally {
      setRevoking(false);
    }
  };

  const handleOpenInNewTab = () => {
    if (shareURL) {
      window.open(shareURL, "_blank");
    }
  };

  return (
    <Modal open onClose={onClose} labelledBy="share-pull-title" contentClassName="max-w-2xl">
      <Card className="border-0 shadow-none">
        <CardHeader>
          <h2 id="share-pull-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Share Pull
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Generate a view-only link that anyone can access
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isShared ? (
            /* Not Shared State */
            <div className="rounded-card border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-6 text-center">
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                This pull is not currently shared. Generate a link to allow anyone with the URL
                to view it.
              </p>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? "Generating..." : "Generate Share Link"}
              </Button>
            </div>
          ) : (
            /* Shared State */
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Shareable Link</label>
                  <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                    Active
                  </span>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={shareURL}
                    readOnly
                    className="flex-1 font-mono text-xs"
                    onClick={(e) => e.target.select()}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopy}
                    className="flex items-center gap-1"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleOpenInNewTab}
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </Button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Anyone with this link can view the pull in read-only mode. They will not be able
                  to edit or export it.
                </p>
              </div>

              <div className="rounded-card border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
                <h3 className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-400">Security Note</h3>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  This link does not require authentication. Only share it with trusted parties.
                  You can revoke access at any time by clicking the button below.
                </p>
              </div>

              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-4">
                <Button
                  variant="secondary"
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {revoking ? "Revoking..." : "Revoke Access"}
                </Button>
                <Button variant="secondary" onClick={onClose}>
                  Done
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </Modal>
  );
}
