import React, { createContext, useContext, useState, useCallback } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

const AlertDialogContext = createContext(null);

export function AlertDialog({ children }) {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <AlertDialogContext.Provider value={{ open, setOpen, handleOpen, handleClose }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

export function AlertDialogTrigger({ children, asChild }) {
  const ctx = useContext(AlertDialogContext);
  if (!ctx) return null;

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e) => {
        children.props.onClick?.(e);
        ctx.handleOpen();
      },
    });
  }

  return (
    <button type="button" onClick={ctx.handleOpen}>
      {children}
    </button>
  );
}

export function AlertDialogContent({ children }) {
  const ctx = useContext(AlertDialogContext);
  if (!ctx) return null;

  return (
    <Modal
      open={ctx.open}
      onClose={ctx.handleClose}
      closeOnOverlay={false}
      contentClassName="!max-w-md !min-h-0"
    >
      <div className="p-6">{children}</div>
    </Modal>
  );
}

export function AlertDialogHeader({ children, className = "" }) {
  return <div className={`space-y-2 ${className}`}>{children}</div>;
}

export function AlertDialogTitle({ children, className = "" }) {
  return (
    <h2 className={`text-lg font-semibold text-slate-900 dark:text-slate-100 ${className}`}>
      {children}
    </h2>
  );
}

export function AlertDialogDescription({ children, className = "" }) {
  return (
    <p className={`text-sm text-slate-600 dark:text-slate-400 ${className}`}>
      {children}
    </p>
  );
}

export function AlertDialogFooter({ children, className = "" }) {
  return (
    <div className={`mt-6 flex justify-end gap-3 ${className}`}>
      {children}
    </div>
  );
}

export function AlertDialogCancel({ children = "Cancel", className = "", ...props }) {
  const ctx = useContext(AlertDialogContext);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={ctx?.handleClose}
      className={className}
      {...props}
    >
      {children}
    </Button>
  );
}

export function AlertDialogAction({ children, onClick, className = "", ...props }) {
  const ctx = useContext(AlertDialogContext);

  const handleClick = (e) => {
    onClick?.(e);
    ctx?.handleClose();
  };

  return (
    <Button type="button" onClick={handleClick} className={className} {...props}>
      {children}
    </Button>
  );
}
