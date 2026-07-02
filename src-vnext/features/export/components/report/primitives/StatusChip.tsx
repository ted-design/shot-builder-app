import {
  deriveStatusChipSpec,
  StatusChipDom,
} from "../../../lib/report/primitives/statusChip"
import type { StatusChipInput } from "../../../lib/report/primitives/statusChip"

// DOM wrapper for the canonical StatusChip primitive. Thin: derives the spec
// from the status + caller-supplied label (+ optional variant preset) and hands
// it to the shared DOM adapter, so the preview and the @react-pdf export present
// ONE spec and can't drift. Does NOT import @react-pdf (the PDF adapter is a
// separate named export in the co-located lib file), so this stays in the
// DOM-only tree.

/** Preview StatusChip — reserved-palette dot (never red; on_hold AMBER) +
 * caller-supplied uppercase label. */
export function StatusChipView(props: StatusChipInput): React.ReactElement {
  return StatusChipDom(
    deriveStatusChipSpec({
      status: props.status,
      label: props.label,
      variant: props.variant,
    }),
  )
}
