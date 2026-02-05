type ToastLevel = "success" | "error" | "info" | "warning";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastPayload =
  | string
  | {
      title?: string;
      description?: string;
      duration?: number;
      action?: ToastAction;
    };

type ToastEvent = {
  id: string;
  level: ToastLevel;
  title?: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
};

type ToastListener = (event: ToastEvent) => void;

const listeners = new Set<ToastListener>();

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function normalisePayload(payload: ToastPayload): {
  title?: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
} {
  if (typeof payload === "string") {
    return { title: payload };
  }
  return payload || {};
}

function emit(level: ToastLevel, payload: ToastPayload) {
  const normalised = normalisePayload(payload);
  const event: ToastEvent = {
    id: randomId(),
    level,
    title: normalised.title,
    description: normalised.description,
    duration: normalised.duration,
    action: normalised.action,
  };
  if (!listeners.size) {
    const consoleMethod = level === "error" ? "error" : "log";
    console[consoleMethod](`[toast:${level}] ${event.title ?? event.description ?? ""}`);
  }
  listeners.forEach((listener) => listener(event));
}

export function subscribeToToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const toast = {
  success: (payload: ToastPayload) => emit("success", payload),
  error: (payload: ToastPayload) => emit("error", payload),
  info: (payload: ToastPayload) => emit("info", payload),
  warning: (payload: ToastPayload) => emit("warning", payload),
};

/**
 * Show a success toast notification
 * @param message - The success message to display
 */
export function showSuccess(message: string): void {
  toast.success({ title: message });
}

/**
 * Show an error toast notification
 * @param message - The error message to display
 */
export function showError(message: string): void {
  toast.error({ title: message });
}

/**
 * Show an info toast notification
 * @param message - The info message to display
 */
export function showInfo(message: string): void {
  toast.info({ title: message });
}

/**
 * Show a confirmation dialog using the existing confirm API
 * Returns a promise that resolves to true if confirmed, false if cancelled
 * @param message - The confirmation message
 * @returns Promise<boolean>
 */
export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Use the browser's native confirm for now
    // This can be replaced with a custom modal in the future
    const result = window.confirm(message);
    resolve(result);
  });
}
