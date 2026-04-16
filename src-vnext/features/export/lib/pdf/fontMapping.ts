/**
 * Map UI font family names to @react-pdf/renderer built-in font families.
 * Built-in fonts: Helvetica, Courier, Times-Roman (+ Bold/Italic variants).
 */
export function mapFontFamilyToPdf(
  fontFamily: string | undefined,
  bold?: boolean,
  italic?: boolean,
): string {
  const base = fontFamily ?? "Helvetica"

  if (base === "Courier New" || base === "Courier") {
    if (bold && italic) return "Courier-BoldOblique"
    if (bold) return "Courier-Bold"
    if (italic) return "Courier-Oblique"
    return "Courier"
  }
  if (base === "Georgia" || base === "Times New Roman") {
    if (bold && italic) return "Times-BoldItalic"
    if (bold) return "Times-Bold"
    if (italic) return "Times-Italic"
    return "Times-Roman"
  }

  if (bold && italic) return "Helvetica-BoldOblique"
  if (bold) return "Helvetica-Bold"
  if (italic) return "Helvetica-Oblique"
  return "Helvetica"
}

/** Map UI font to its PDF base family (no bold/italic variant) */
export function mapFontFamilyBase(fontFamily: string | undefined): string {
  return mapFontFamilyToPdf(fontFamily)
}
