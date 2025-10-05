// src/components/pulls/ChangeOrderReviewModal.jsx
//
// Modal for producers to review and approve/reject change orders
// requested by warehouse staff.

import React, { useState } from "react";
import { Modal } from "../ui/modal";
import { Card, CardHeader, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { getPullItemDisplayName } from "../../lib/pullItems";
import { toast } from "../../lib/toast";

export default function ChangeOrderReviewModal({
  item,
  changeOrder,
  onApprove,
  onReject,
  onClose,
}) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleApprove = () => {
    if (window.confirm("Approve this substitution? This will update the pull item.")) {
      onApprove(changeOrder.id);
    }
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast.error({ title: "Please provide a reason for rejection" });
      return;
    }

    if (window.confirm("Reject this substitution request?")) {
      onReject(changeOrder.id, rejectionReason.trim());
    }
  };

  const requestedDate = changeOrder.requestedAt
    ? new Date(
        changeOrder.requestedAt.seconds
          ? changeOrder.requestedAt.seconds * 1000
          : changeOrder.requestedAt
      ).toLocaleString()
    : "Unknown";

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="review-change-order-title"
      contentClassName="max-w-3xl"
    >
      <Card className="border-0 shadow-none">
        <CardHeader>
          <h2 id="review-change-order-title" className="text-lg font-semibold">
            Review Product Substitution
          </h2>
          <p className="text-sm text-slate-600">
            Requested by {changeOrder.requestedByName || "Unknown"} on {requestedDate}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Reason */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-1 text-sm font-semibold text-amber-900">Reason for Substitution</h3>
            <p className="text-sm text-amber-800">{changeOrder.reason}</p>
          </div>

          {/* Comparison Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Original */}
            <div className="rounded-lg border-2 border-slate-300 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Original Request</h3>
              <div className="space-y-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {getPullItemDisplayName(item)}
                  </div>
                  {item.styleNumber && (
                    <div className="text-xs text-slate-500">Style: {item.styleNumber}</div>
                  )}
                </div>

                {item.sizes && item.sizes.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Sizes & Quantities
                    </div>
                    <div className="space-y-1">
                      {item.sizes.map((size, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-slate-700">{size.size}</span>
                          <span className="text-slate-900">Qty {size.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {item.notes && (
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Notes
                    </div>
                    <p className="text-xs text-slate-600">{item.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Proposed Substitute */}
            <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-blue-900">
                Proposed Substitute
              </h3>
              <div className="space-y-2">
                <div>
                  <div className="text-sm font-medium text-blue-900">
                    {changeOrder.substitution.familyName}
                    {changeOrder.substitution.colourName &&
                      ` – ${changeOrder.substitution.colourName}`}
                  </div>
                  {changeOrder.substitution.styleNumber && (
                    <div className="text-xs text-blue-700">
                      Style: {changeOrder.substitution.styleNumber}
                    </div>
                  )}
                </div>

                {changeOrder.substitution.sizes && changeOrder.substitution.sizes.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                      Sizes & Quantities
                    </div>
                    <div className="space-y-1">
                      {changeOrder.substitution.sizes.map((size, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-blue-800">{size.size}</span>
                          <span className="text-blue-900">Qty {size.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rejection Input (conditional) */}
          {showRejectInput && (
            <div className="space-y-2">
              <label htmlFor="rejection-reason" className="text-sm font-medium text-slate-700">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                id="rejection-reason"
                className="w-full rounded-md border border-slate-200 p-3 text-sm"
                rows={3}
                placeholder="Explain why this substitution cannot be approved..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {!showRejectInput ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setShowRejectInput(true)}
                  className="border-red-600 text-red-600 hover:bg-red-50"
                >
                  Reject
                </Button>
                <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
                  Approve Substitution
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setShowRejectInput(false)}>
                  Cancel Rejection
                </Button>
                <Button
                  onClick={handleReject}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Confirm Rejection
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
