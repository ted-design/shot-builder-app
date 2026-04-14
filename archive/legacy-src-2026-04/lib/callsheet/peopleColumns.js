export const DEFAULT_TALENT_ROSTER_COLUMNS = [
  { key: "id", label: "ID", width: "xs", visible: true, order: 0 },
  { key: "name", label: "Talent", width: "lg", visible: true, order: 1 },
  { key: "role", label: "Role", width: "md", visible: true, order: 2 },
  { key: "status", label: "Status", width: "md", visible: true, order: 3 },
  { key: "transportation", label: "Transpo", width: "lg", visible: true, order: 4 },
  { key: "call", label: "Call", width: "md", visible: true, order: 5 },
  { key: "blockRhs", label: "BLK/RHS", width: "md", visible: true, order: 6 },
  { key: "muWard", label: "MU/WARD", width: "md", visible: true, order: 7 },
  { key: "set", label: "Set", width: "sm", visible: true, order: 8 },
  { key: "remarks", label: "Remarks", width: "xl", visible: true, order: 9 },
];

export const DEFAULT_CLIENT_ROSTER_COLUMNS = [
  { key: "id", label: "ID", width: "xs", visible: true, order: 0 },
  { key: "name", label: "Client", width: "lg", visible: true, order: 1 },
  { key: "role", label: "Role", width: "md", visible: true, order: 2 },
  { key: "status", label: "Status", width: "md", visible: true, order: 3 },
  { key: "transportation", label: "Transpo", width: "lg", visible: true, order: 4 },
  { key: "call", label: "Call", width: "md", visible: true, order: 5 },
  { key: "blockRhs", label: "BLK/RHS", width: "md", visible: true, order: 6 },
  { key: "muWard", label: "MU/WARD", width: "md", visible: true, order: 7 },
  { key: "set", label: "Set", width: "sm", visible: true, order: 8 },
  { key: "remarks", label: "Remarks", width: "xl", visible: true, order: 9 },
];

export function normalizeRosterColumns(inputColumns, defaults) {
  const fallback = Array.isArray(defaults) ? defaults : [];
  const input = Array.isArray(inputColumns) ? inputColumns : null;
  if (!input || input.length === 0) return fallback.map((c) => ({ ...c }));

  const defaultsByKey = new Map(fallback.map((c) => [c.key, c]));
  const next = [];

  input.forEach((col, idx) => {
    if (!col || !col.key) return;
    const def = defaultsByKey.get(col.key);
    const base = def ? { ...def } : { key: String(col.key), label: String(col.label || col.key), width: "md" };
    next.push({
      ...base,
      label: col.label != null ? String(col.label) : base.label,
      width: col.width || base.width,
      visible: col.visible !== false,
      order: Number.isFinite(col.order) ? col.order : idx,
    });
    defaultsByKey.delete(col.key);
  });

  for (const def of defaultsByKey.values()) {
    next.push({ ...def, order: next.length });
  }

  return next.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

