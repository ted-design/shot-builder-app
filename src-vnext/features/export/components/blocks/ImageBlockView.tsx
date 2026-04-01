import type { ImageBlock } from "../../types/exportBuilder"

interface ImageBlockViewProps {
  readonly block: ImageBlock
}

const ALIGNMENT_CLASSES: Record<string, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
}

export function ImageBlockView({ block }: ImageBlockViewProps) {
  const alignment = block.alignment ?? "center"
  const width = block.width ?? 100

  if (!block.src) {
    return (
      <div
        data-testid="image-block"
        className={`flex ${ALIGNMENT_CLASSES[alignment] ?? "justify-center"}`}
      >
        <div
          className="flex items-center justify-center rounded border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400"
          style={{ width: `${String(width)}%`, height: "120px" }}
        >
          Drop image or click to upload
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="image-block"
      className={`flex ${ALIGNMENT_CLASSES[alignment] ?? "justify-center"}`}
    >
      <img
        src={block.src}
        alt={block.alt ?? ""}
        style={{ width: `${String(width)}%` }}
        className="rounded"
      />
    </div>
  )
}
