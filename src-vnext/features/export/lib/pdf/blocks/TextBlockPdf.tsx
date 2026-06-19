import type { TextBlock, ExportVariable } from "../../../types/exportBuilder"
import { deriveTextSpec } from "../../blockSpec"
import { renderBlockSpecPdf } from "../specAdapters/pdf"

interface TextBlockPdfProps {
  readonly block: TextBlock
  readonly variables: readonly ExportVariable[]
}

export function TextBlockPdf({ block, variables }: TextBlockPdfProps) {
  if (!block.content) return null
  return renderBlockSpecPdf(deriveTextSpec(block, { variables }))
}
