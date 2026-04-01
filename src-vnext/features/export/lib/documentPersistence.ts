import type { ExportDocument, ExportTemplate } from "../types/exportBuilder"

const DOCUMENT_KEY_PREFIX = "sb:export-doc:"
const TEMPLATES_KEY = "sb:export-templates"

/** Save the current document for a given project */
export function saveDocument(projectId: string, doc: ExportDocument): void {
  try {
    const key = `${DOCUMENT_KEY_PREFIX}${projectId}`
    localStorage.setItem(key, JSON.stringify(doc))
  } catch {
    // localStorage may be full or unavailable — fail silently
  }
}

/** Load a previously saved document for a given project */
export function loadDocument(projectId: string): ExportDocument | null {
  try {
    const key = `${DOCUMENT_KEY_PREFIX}${projectId}`
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as ExportDocument
  } catch {
    return null
  }
}

/** Save a user template to localStorage */
export function saveTemplate(template: ExportTemplate): void {
  try {
    const existing = loadTemplates()
    const filtered = existing.filter((t) => t.id !== template.id)
    const updated = [...filtered, template]
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated))
  } catch {
    // localStorage may be full or unavailable — fail silently
  }
}

/** Load all saved user templates from localStorage */
export function loadTemplates(): ExportTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ExportTemplate[]
  } catch {
    return []
  }
}

/** Delete a saved user template by id */
export function deleteTemplate(templateId: string): void {
  try {
    const existing = loadTemplates()
    const filtered = existing.filter((t) => t.id !== templateId)
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(filtered))
  } catch {
    // localStorage may be full or unavailable — fail silently
  }
}
