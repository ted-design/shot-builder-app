// src/lib/pullSharing.js
//
// Utility functions for generating and managing shareable pull links

/**
 * Generate a random share token for a pull
 * @returns {string} Share token
 */
export const generateShareToken = () => {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const length = 16;
  let token = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    token += characters[randomIndex];
  }

  return token;
};

/**
 * Validate a share token and check if it's still valid
 * @param {string} token - Share token to validate
 * @param {Object} pull - Pull document
 * @returns {Object} { valid: boolean, reason?: string }
 */
export const validateShareToken = (token, pull) => {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "Invalid token" };
  }

  if (!pull) {
    return { valid: false, reason: "Pull not found" };
  }

  if (!pull.shareEnabled) {
    return { valid: false, reason: "Sharing is disabled for this pull" };
  }

  if (pull.shareToken !== token) {
    return { valid: false, reason: "Token does not match" };
  }

  // Check expiration
  if (pull.shareExpiresAt) {
    const expirationDate = pull.shareExpiresAt.toDate
      ? pull.shareExpiresAt.toDate()
      : new Date(pull.shareExpiresAt);

    if (expirationDate < new Date()) {
      return { valid: false, reason: "Share link has expired" };
    }
  }

  return { valid: true };
};

/**
 * Get the shareable URL for a pull
 * @param {string} token - Share token
 * @returns {string} Full shareable URL
 */
export const getShareableURL = (token) => {
  const baseURL = window.location.origin;
  return `${baseURL}/pulls/shared/${token}`;
};

/**
 * Copy shareable URL to clipboard
 * @param {string} token - Share token
 * @returns {Promise<void>}
 */
export const copyShareURLToClipboard = async (token) => {
  const url = getShareableURL(token);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(url);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = url;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
};
