import React from "react";
import { cn } from "../../../../lib/utils";

interface DocumentPageProps {
  children: React.ReactNode;
  showMobile?: boolean;
  className?: string;
  contentClassName?: string;
  style?: React.CSSProperties;
}

export function DocumentPage({
  children,
  showMobile = false,
  className,
  contentClassName,
  style,
}: DocumentPageProps) {
  return (
    <div
      className={cn(
        "doc-page mx-auto",
        showMobile ? "w-[375px]" : "w-[8.5in]",
        className
      )}
      style={{
        minHeight: showMobile ? "auto" : "11in",
        ...style,
      }}
    >
      <div className={cn("doc-page-content", contentClassName)}>{children}</div>
    </div>
  );
}

