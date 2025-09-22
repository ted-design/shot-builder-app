const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export function readStorage(key, fallback = null) {
  if (!isBrowser) return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    console.warn(`[storage] Failed to read key "${key}"`, error);
    return fallback;
  }
}

export function writeStorage(key, value) {
  if (!isBrowser) return false;
  if (value == null) return removeStorage(key);
  try {
    window.localStorage.setItem(key, String(value));
    return true;
  } catch (error) {
    console.warn(`[storage] Failed to write key "${key}"`, error);
    return false;
  }
}

export function removeStorage(key) {
  if (!isBrowser) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[storage] Failed to remove key "${key}"`, error);
    return false;
  }
}
