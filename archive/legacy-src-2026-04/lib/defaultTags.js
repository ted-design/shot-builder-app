export const DEFAULT_TAG_GROUPS = [
  {
    id: "priority",
    label: "Priority Tags",
    description: "Quickly communicate the urgency of a shot",
    tags: [
      {
        id: "default-priority-high",
        label: "High Priority",
        color: "red",
      },
      {
        id: "default-priority-medium",
        label: "Medium Priority",
        color: "amber",
      },
      {
        id: "default-priority-low",
        label: "Low Priority",
        color: "green",
      },
    ],
  },
  {
    id: "gender",
    label: "Gender Tags",
    description: "Align talent and styling expectations",
    tags: [
      {
        id: "default-gender-men",
        label: "Men",
        color: "blue",
      },
      {
        id: "default-gender-women",
        label: "Women",
        color: "pink",
      },
      {
        id: "default-gender-unisex",
        label: "Unisex",
        color: "purple",
      },
    ],
  },
  {
    id: "media",
    label: "Media Tags",
    description: "Clarify deliverable formats",
    tags: [
      {
        id: "default-media-photo",
        label: "Photo",
        color: "emerald",
      },
      {
        id: "default-media-video",
        label: "Video",
        color: "orange",
      },
    ],
  },
];

export const DEFAULT_TAGS = DEFAULT_TAG_GROUPS.flatMap((group) =>
  group.tags.map((tag) => ({
    ...tag,
    groupId: group.id,
    groupLabel: group.label,
    groupDescription: group.description,
    isDefault: true,
  }))
);

export const DEFAULT_TAG_GROUP_ORDER = DEFAULT_TAG_GROUPS.map((group) => group.id);
