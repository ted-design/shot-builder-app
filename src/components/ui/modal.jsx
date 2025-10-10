import React from "react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusables(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter((el) =>
    !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden")
  );
}

export function Modal({
  open,
  onClose,
  children,
  labelledBy,
  describedBy,
  initialFocusRef,
  contentClassName = "",
  overlayClassName = "",
  closeOnOverlay = true,
}) {
  const [mountNode, setMountNode] = useState(null);
  const contentRef = useRef(null);
  const lastActiveRef = useRef(null);
  const mouseDownTarget = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const node = document.createElement("div");
    node.setAttribute("data-modal-root", "");
    document.body.appendChild(node);
    setMountNode(node);
    return () => {
      document.body.removeChild(node);
    };
  }, []);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === "undefined" || !mountNode) return undefined;
    lastActiveRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const node = contentRef.current;
    const focusables = getFocusables(node);
    const initialTarget = initialFocusRef?.current || focusables[0] || node;
    requestAnimationFrame(() => {
      initialTarget?.focus?.({ preventScroll: true });
    });

    function handleKeydown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const items = getFocusables(node);
      if (!items.length) {
        event.preventDefault();
        node?.focus?.({ preventScroll: true });
        return;
      }
      const active = document.activeElement;
      const currentIndex = items.findIndex((el) => el === active);
      const delta = event.shiftKey ? -1 : 1;
      let nextIndex = currentIndex;
      if (currentIndex === -1) {
        nextIndex = event.shiftKey ? items.length - 1 : 0;
      } else {
        nextIndex = (currentIndex + delta + items.length) % items.length;
      }
      event.preventDefault();
      const next = items[nextIndex] || node;
      next.focus();
    }

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      lastActiveRef.current?.focus?.({ preventScroll: true });
      lastActiveRef.current = null;
    };
  }, [open, initialFocusRef, mountNode]);

  const overlayProps = useMemo(
    () => ({
      onMouseDown: (event) => {
        mouseDownTarget.current = event.target;
      },
      onMouseUp: (event) => {
        if (!closeOnOverlay) return;
        if (mouseDownTarget.current !== event.target) return;
        if (event.target === event.currentTarget) onClose?.();
      },
    }),
    [closeOnOverlay, onClose]
  );

  if (!open || !mountNode) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/40 p-0 sm:p-4 md:items-center md:p-6 animate-fade-in ${overlayClassName}`.trim()}
      {...overlayProps}
      data-testid="modal-overlay"
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`relative w-full md:max-w-3xl md:rounded-xl bg-white shadow-xl outline-none min-h-screen md:min-h-0 md:max-h-[min(90vh,calc(100dvh-48px))] flex flex-col animate-fade-in animate-zoom-in ${contentClassName}`.trim()}
        style={{ animationDuration: '300ms' }}
      >
        {children}
      </div>
    </div>,
    mountNode
  );
}

export default Modal;
