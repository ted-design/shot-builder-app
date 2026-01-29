/**
 * Detect mobile browsers where signInWithPopup is unreliable.
 * On these platforms, signInWithRedirect is used directly.
 */
export function isMobileBrowser() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
