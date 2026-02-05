import { useEffect, useMemo, useRef, useState } from "react";
import { subscribeToToasts } from "../../lib/toast";

const DEFAULT_DURATION = 4000;

const VARIANT_STYLES = {
  success: "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100",
  error: "border-red-500 bg-red-50 dark:bg-red-900/30 text-red-900 dark:text-red-100",
  info: "border-sky-500 bg-sky-50 dark:bg-sky-900/30 text-sky-900 dark:text-sky-100",
  warning: "border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100",
};

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timeoutsRef = useRef(new Map());

  useEffect(() => {
    const unsubscribe = subscribeToToasts((event) => {
      setToasts((prev) => [...prev, event]);
      const timeout = window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== event.id));
        timeoutsRef.current.delete(event.id);
      }, event.duration ?? DEFAULT_DURATION);
      timeoutsRef.current.set(event.id, timeout);
    });
    return () => {
      unsubscribe();
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  const renderedToasts = useMemo(() => toasts.slice(-4), [toasts]);

  return (
    <>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-6 z-[9999] flex flex-col items-center gap-2 px-4">
        {renderedToasts.map((toast) => {
          const styles = VARIANT_STYLES[toast.level] || VARIANT_STYLES.info;
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${styles}`}
            >
              <div className="flex-1">
                {toast.title && <div className="text-sm font-semibold">{toast.title}</div>}
                {toast.description && (
                  <div className="text-sm leading-snug text-slate-700 dark:text-slate-200">{toast.description}</div>
                )}
              </div>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      toast.action.onClick?.();
                    } finally {
                      const timeout = timeoutsRef.current.get(toast.id);
                      if (timeout) {
                        clearTimeout(timeout);
                        timeoutsRef.current.delete(toast.id);
                      }
                      setToasts((prev) => prev.filter((item) => item.id !== toast.id));
                    }
                  }}
                  className="mt-0.5 text-xs font-semibold uppercase text-slate-700 dark:text-slate-100 hover:text-slate-900 dark:hover:text-white"
                >
                  {toast.action.label}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const timeout = timeoutsRef.current.get(toast.id);
                  if (timeout) {
                    clearTimeout(timeout);
                    timeoutsRef.current.delete(toast.id);
                  }
                  setToasts((prev) => prev.filter((item) => item.id !== toast.id));
                }}
                className="mt-0.5 text-xs font-semibold uppercase text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-100"
              >
                Close
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
