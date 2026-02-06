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
      { id: "default-priority-high", label: "High Priority", color: "red" satisfies TagColorKey, category: "priority" },
      { id: "default-priority-medium", label: "Medium Priority", color: "amber" satisfies TagColorKey, category: "priority" },
      { id: "default-priority-low", label: "Low Priority", color: "green" satisfies TagColorKey, category: "priority" },
    ],
  },
  {
    id: "gender",
    label: "Gender Tags",
    description: "Align talent and styling expectations",
    tags: [
      { id: "default-gender-men", label: "Men", color: "blue" satisfies TagColorKey, category: "gender" },
      { id: "default-gender-women", label: "Women", color: "pink" satisfies TagColorKey, category: "gender" },
      { id: "default-gender-unisex", label: "Unisex", color: "purple" satisfies TagColorKey, category: "gender" },
    ],
  },
  {
    id: "media",
    label: "Media Tags",
    description: "Clarify deliverable formats",
    tags: [
      { id: "default-media-photo", label: "Photo", color: "emerald" satisfies TagColorKey, category: "media" },
      { id: "default-media-video", label: "Video", color: "orange" satisfies TagColorKey, category: "media" },
    ],
  },
] as const

export const DEFAULT_TAGS: ReadonlyArray<ShotTag> = DEFAULT_TAG_GROUPS.flatMap((group) => group.tags)
