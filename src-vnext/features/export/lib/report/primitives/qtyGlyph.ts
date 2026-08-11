// Canonical pending-qty glyph. Kills the image-led "×—"; "—" wins.
export function qtyGlyph(qty: number | null): string {
  return qty != null ? `×${String(qty)}` : "—"
}
