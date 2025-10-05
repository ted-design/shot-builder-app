// src/lib/changeOrders.js
//
// Utility functions for managing change orders in pull items.
// Change orders allow warehouse staff to request product substitutions
// when the requested item cannot be fulfilled.

import { generatePullItemId } from "./pullItems";

/**
 * Generate a unique ID for change orders
 */
export const generateChangeOrderId = () => generatePullItemId();

/**
 * Create a new change order for a pull item
 * @param {Object} params
 * @param {Object} params.substitution - The proposed substitute product
 * @param {string} params.reason - Reason for the change
 * @param {string} params.userId - ID of user requesting change
 * @param {string} params.userName - Name of user requesting change
 * @returns {Object} ChangeOrder
 */
export const createChangeOrder = ({ substitution, reason, userId, userName }) => {
  return {
    id: generateChangeOrderId(),
    requestedBy: userId,
    requestedByName: userName,
    requestedAt: new Date(),
    reason: reason.trim(),
    status: "pending",
    substitution: {
      familyId: substitution.familyId,
      familyName: substitution.familyName,
      styleNumber: substitution.styleNumber || null,
      colourId: substitution.colourId || null,
      colourName: substitution.colourName || null,
      colourImagePath: substitution.colourImagePath || null,
      sizes: substitution.sizes.map((s) => ({
        size: s.size,
        quantity: s.quantity,
      })),
      gender: substitution.gender || null,
      category: substitution.category || null,
    },
  };
};

/**
 * Approve a change order and apply the substitution to the pull item
 * @param {Object} item - The pull item
 * @param {string} changeOrderId - ID of change order to approve
 * @param {string} userId - ID of user approving
 * @param {string} userName - Name of user approving
 * @returns {Object} Updated pull item
 */
export const approveChangeOrder = (item, changeOrderId, userId, userName) => {
  if (!item || !Array.isArray(item.changeOrders)) {
    throw new Error("Invalid item or no change orders");
  }

  const changeOrder = item.changeOrders.find((co) => co.id === changeOrderId);
  if (!changeOrder) {
    throw new Error("Change order not found");
  }

  if (changeOrder.status !== "pending") {
    throw new Error("Change order is not pending");
  }

  // Mark change order as approved
  const updatedChangeOrders = item.changeOrders.map((co) =>
    co.id === changeOrderId
      ? {
          ...co,
          status: "approved",
          approvedBy: userId,
          approvedByName: userName,
          approvedAt: new Date(),
        }
      : co
  );

  // Apply the substitution - replace product details
  const substitution = changeOrder.substitution;

  return {
    ...item,
    // Update product details with substitution
    familyId: substitution.familyId,
    familyName: substitution.familyName,
    styleNumber: substitution.styleNumber || item.styleNumber,
    colourId: substitution.colourId,
    colourName: substitution.colourName,
    colourImagePath: substitution.colourImagePath,

    // Update sizes with substitution
    sizes: substitution.sizes.map((s) => ({
      size: s.size,
      quantity: s.quantity,
      fulfilled: 0,
      status: "substituted",
    })),

    // Update gender/category if provided
    gender: substitution.gender || item.gender,
    category: substitution.category || item.category,

    // Mark overall fulfillment status
    fulfillmentStatus: "substituted",

    // Update change orders
    changeOrders: updatedChangeOrders,

    // Add note about substitution
    notes: item.notes
      ? `${item.notes}\n[SUBSTITUTED: Approved by ${userName}]`
      : `[SUBSTITUTED: Approved by ${userName}]`,
  };
};

/**
 * Reject a change order
 * @param {Object} item - The pull item
 * @param {string} changeOrderId - ID of change order to reject
 * @param {string} reason - Reason for rejection
 * @param {string} userId - ID of user rejecting
 * @param {string} userName - Name of user rejecting
 * @returns {Object} Updated pull item
 */
export const rejectChangeOrder = (item, changeOrderId, reason, userId, userName) => {
  if (!item || !Array.isArray(item.changeOrders)) {
    throw new Error("Invalid item or no change orders");
  }

  const changeOrder = item.changeOrders.find((co) => co.id === changeOrderId);
  if (!changeOrder) {
    throw new Error("Change order not found");
  }

  if (changeOrder.status !== "pending") {
    throw new Error("Change order is not pending");
  }

  // Mark change order as rejected
  const updatedChangeOrders = item.changeOrders.map((co) =>
    co.id === changeOrderId
      ? {
          ...co,
          status: "rejected",
          rejectionReason: reason.trim(),
          rejectedBy: userId,
          rejectedByName: userName,
          rejectedAt: new Date(),
        }
      : co
  );

  return {
    ...item,
    changeOrders: updatedChangeOrders,
  };
};

/**
 * Add a change order to a pull item
 * @param {Object} item - The pull item
 * @param {Object} changeOrder - The change order to add
 * @returns {Object} Updated pull item
 */
export const addChangeOrderToItem = (item, changeOrder) => {
  return {
    ...item,
    changeOrders: [...(item.changeOrders || []), changeOrder],
  };
};

/**
 * Get pending change orders from a pull item
 * @param {Object} item - The pull item
 * @returns {Array} Pending change orders
 */
export const getPendingChangeOrders = (item) => {
  if (!item || !Array.isArray(item.changeOrders)) return [];
  return item.changeOrders.filter((co) => co.status === "pending");
};

/**
 * Check if an item has pending change orders
 * @param {Object} item - The pull item
 * @returns {boolean}
 */
export const hasPendingChangeOrders = (item) => {
  return getPendingChangeOrders(item).length > 0;
};

/**
 * Get all pending change orders from all items in a pull
 * @param {Array} items - Pull items
 * @returns {Array} Array of { item, changeOrders }
 */
export const getAllPendingChangeOrders = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      item,
      changeOrders: getPendingChangeOrders(item),
    }))
    .filter((entry) => entry.changeOrders.length > 0);
};

/**
 * Count total pending change orders in a pull
 * @param {Array} items - Pull items
 * @returns {number}
 */
export const countPendingChangeOrders = (items) => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + getPendingChangeOrders(item).length, 0);
};
