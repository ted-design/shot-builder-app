type ToastLevel = "success" | "error" | "info" | "warning";

type ToastPayload =
  | string
  | {
      title?: string;
      description?: string;
      duration?: number;
    };

type ToastEvent = {
  id: string;
  level: ToastLevel;
  title?: string;
  description?: string;
  duration?: number;
};

type ToastListener = (event: ToastEvent) => void;

const listeners = new Set<ToastListener>();

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function normalisePayload(payload: ToastPayload): { title?: string; description?: string; duration?: number } {
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
