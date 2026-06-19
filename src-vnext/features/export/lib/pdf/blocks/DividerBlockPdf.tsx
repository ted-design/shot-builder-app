import type { DividerBlock } from "../../../types/exportBuilder"
import { deriveDividerSpec } from "../../blockSpec"
import { renderBlockSpecPdf } from "../specAdapters/pdf"

interface DividerBlockPdfProps {
  readonly block: DividerBlock
}

export function DividerBlockPdf({ block }: DividerBlockPdfProps) {
  return renderBlockSpecPdf(deriveDividerSpec(block))
}
