import { describe, it, expect, beforeEach } from "vitest";
import {
  cloneShotDraft,
  createInitialSectionStatuses,
  deriveSectionStatuses,
  markSectionsForState,
  EDITOR_SECTION_IDS,
} from "../shotSectionStatus";
import { DEFAULT_SHOT_STATUS } from "../shotStatus";

const buildBaselineDraft = () => ({
  name: "Hero shot",
  description: "Rich copy",
  type: "lifestyle",
  status: DEFAULT_SHOT_STATUS,
  date: "2024-10-12",
  locationId: "loc-1",
  products: [
    {
      id: "prod-1",
      familyId: "prod-1",
      colourId: "col-1",
      size: "M",
      sizeScope: "single",
      status: "complete",
    },
  ],
  talent: [{ talentId: "tal-1", name: "Pat" }],
  tags: [{ id: "tag-1", label: "Campaign", color: "indigo" }],
  referenceImagePath: "path.jpg",
  referenceImageCrop: { x: 40, y: 60 },
  referenceImageFile: null,
});

describe("shotSectionStatus helpers", () => {
  let baseline;

  beforeEach(() => {
    baseline = cloneShotDraft(buildBaselineDraft());
  });

  it("creates saved statuses for every editor section", () => {
    const statuses = createInitialSectionStatuses();
    EDITOR_SECTION_IDS.forEach((section) => {
      expect(statuses[section]).toEqual({ state: "saved" });
    });
  });

  it("marks basics and logistics pending when their fields change", () => {
    const draft = cloneShotDraft({
      ...baseline,
      name: "Updated",
      products: [
        ...baseline.products,
        {
          id: "prod-2",
          familyId: "prod-2",
          colourId: "col-2",
          size: null,
          sizeScope: "all",
          status: "complete",
        },
      ],
    });

    const next = deriveSectionStatuses(draft, baseline, createInitialSectionStatuses());
    expect(next.basics.state).toBe("pending");
    expect(next.logistics.state).toBe("pending");
    expect(next.creative.state).toBe("saved");
    expect(next.attachments.state).toBe("saved");
  });

  it("preserves saving state until resolution", () => {
    const previous = {
      basics: { state: "saving" },
      logistics: { state: "pending" },
      creative: { state: "saved" },
      attachments: { state: "saved" },
    };
    const next = deriveSectionStatuses(baseline, baseline, previous);
    expect(next.basics.state).toBe("saving");
    expect(next.logistics.state).toBe("saved");
  });

  it("marks only changed sections when forcing a new state", () => {
    const draft = {
      ...baseline,
      referenceImageFile: { name: "mock.png" },
    };

    const current = createInitialSectionStatuses();
    const marked = markSectionsForState(current, draft, baseline, "saving", { timestamp: 123 });
    expect(marked.attachments).toEqual({ state: "saving", timestamp: 123 });
    expect(marked.basics.state).toBe("saved");
  });
});
