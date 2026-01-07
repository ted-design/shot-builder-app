import React from "react";

export function PageBreak() {
  return (
    <div className="flex items-center gap-4 my-6 px-4">
      <div className="flex-1 border-t-2 border-dashed border-[var(--cs-accent)]" />
      <span className="text-xs font-medium text-[var(--cs-accent)] uppercase tracking-wider">
        Page Break
      </span>
      <div className="flex-1 border-t-2 border-dashed border-[var(--cs-accent)]" />
    </div>
  );
}

