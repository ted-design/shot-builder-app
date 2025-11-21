// Scope type used by Library (org) and project Assets (project)
export type Scope =
  | { type: "org" }
  | { type: "project"; projectId: string };

