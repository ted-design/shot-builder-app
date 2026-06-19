import type { DividerBlock } from "../../types/exportBuilder"
import { deriveDividerSpec } from "../../lib/blockSpec"
import { renderBlockSpecDom } from "../../lib/specAdapters/dom"

interface DividerBlockViewProps {
  readonly block: DividerBlock
}

export function DividerBlockView({ block }: DividerBlockViewProps) {
  return renderBlockSpecDom(deriveDividerSpec(block))
}
