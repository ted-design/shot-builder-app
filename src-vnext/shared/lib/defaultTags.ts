import type { ShotTag } from "@/shared/types"
import type { TagColorKey } from "@/shared/lib/tagColors"

export type DefaultTagGroupId = "priority" | "gender" | "media"

export type TagGroup = {
  readonly id: DefaultTagGroupId
  readonly label: string
  readonly description: string
  readonly tags: ReadonlyArray<ShotTag>
}

export const DEFAULT_TAG_GROUPS: ReadonlyArray<TagGroup> = [
  {
    id: "priority",
    label: "Priority Tags",
    description: "Quickly communicate the urgency of a shot",
    tags: [
      { id: "default-priority-high", label: "High Priority", color: "red" satisfies TagColorKey },
      { id: "default-priority-medium", label: "Medium Priority", color: "amber" satisfies TagColorKey },
      { id: "default-priority-low", label: "Low Priority", color: "green" satisfies TagColorKey },
    ],
  },
  {
    id: "gender",
    label: "Gender Tags",
    description: "Align talent and styling expectations",
    tags: [
      { id: "default-gender-men", label: "Men", color: "blue" satisfies TagColorKey },
      { id: "default-gender-women", label: "Women", color: "pink" satisfies TagColorKey },
      { id: "default-gender-unisex", label: "Unisex", color: "purple" satisfies TagColorKey },
    ],
  },
  {
    id: "media",
    label: "Media Tags",
    description: "Clarify deliverable formats",
    tags: [
      { id: "default-media-photo", label: "Photo", color: "emerald" satisfies TagColorKey },
      { id: "default-media-video", label: "Video", color: "orange" satisfies TagColorKey },
    ],
  },
] as const

export const DEFAULT_TAGS: ReadonlyArray<ShotTag> = DEFAULT_TAG_GROUPS.flatMap((group) => group.tags)

