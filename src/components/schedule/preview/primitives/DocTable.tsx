import React from "react";
import { cn } from "../../../../lib/utils";

interface DocTableProps {
  children: React.ReactNode;
  className?: string;
}

export function DocTable({ children, className }: DocTableProps) {
  return <table className={cn("doc-table", className)}>{children}</table>;
}

