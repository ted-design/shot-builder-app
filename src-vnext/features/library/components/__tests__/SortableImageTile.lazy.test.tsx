import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { DndContext } from "@dnd-kit/core"
import { SortableContext } from "@dnd-kit/sortable"
import { SortableImageTile } from "@/features/library/components/SortableImageTile"
import type { TalentImage } from "@/features/library/components/talentUtils"

vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: () => "https://example.test/img.jpg",
}))

const image: TalentImage = { id: "img-1", path: "talent/t1/img-1.jpg" }

function renderTile() {
  return render(
    <DndContext>
      <SortableContext items={[image.id]}>
        <SortableImageTile
          image={image}
          disabled={false}
          onDelete={() => {}}
          onCaptionSave={() => {}}
        />
      </SortableContext>
    </DndContext>,
  )
}

describe("SortableImageTile — Phase 6 lazy images (featureTalentLazy)", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("omits loading=\"lazy\" when the flag is off (byte-identical default)", () => {
    renderTile()
    expect(screen.getByRole("img")).not.toHaveAttribute("loading")
  })

  it("sets loading=\"lazy\" when VITE_TALENT_LAZY is enabled", () => {
    vi.stubEnv("VITE_TALENT_LAZY", "1")
    renderTile()
    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy")
  })
})
