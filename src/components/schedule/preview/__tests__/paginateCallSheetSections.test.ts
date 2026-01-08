import { describe, expect, it } from "vitest";
import type { CallSheetSection } from "../../../../types/callsheet";
import { paginateCallSheetSections } from "../paginateCallSheetSections";

function section(
  partial: Partial<CallSheetSection> & Pick<CallSheetSection, "id" | "type">
): CallSheetSection {
  return {
    id: partial.id,
    type: partial.type,
    isVisible: partial.isVisible ?? true,
    order: partial.order ?? 0,
    config: partial.config ?? {},
  };
}

describe("paginateCallSheetSections", () => {
  it("sorts by order and preserves section order within a page", () => {
    const pages = paginateCallSheetSections([
      section({ id: "b", type: "talent", order: 2 }),
      section({ id: "a", type: "schedule", order: 1 }),
    ]);

    expect(pages).toHaveLength(1);
    expect(pages[0].map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("splits pages at visible page-break markers", () => {
    const pages = paginateCallSheetSections([
      section({ id: "schedule", type: "schedule", order: 0 }),
      section({ id: "break", type: "page-break", order: 1 }),
      section({ id: "talent", type: "talent", order: 2 }),
    ]);

    expect(pages).toHaveLength(2);
    expect(pages[0].map((s) => s.id)).toEqual(["schedule"]);
    expect(pages[1].map((s) => s.id)).toEqual(["talent"]);
  });

  it("does not create an empty trailing page for terminal page breaks", () => {
    const pages = paginateCallSheetSections([
      section({ id: "schedule", type: "schedule", order: 0 }),
      section({ id: "break", type: "page-break", order: 1 }),
    ]);

    expect(pages).toHaveLength(1);
    expect(pages[0].map((s) => s.id)).toEqual(["schedule"]);
  });

  it("ignores hidden page breaks", () => {
    const pages = paginateCallSheetSections([
      section({ id: "schedule", type: "schedule", order: 0 }),
      section({ id: "break", type: "page-break", order: 1, isVisible: false }),
      section({ id: "talent", type: "talent", order: 2 }),
    ]);

    expect(pages).toHaveLength(1);
    expect(pages[0].map((s) => s.id)).toEqual(["schedule", "talent"]);
  });

  it("does not create empty pages for consecutive breaks", () => {
    const pages = paginateCallSheetSections([
      section({ id: "schedule", type: "schedule", order: 0 }),
      section({ id: "break-1", type: "page-break", order: 1 }),
      section({ id: "break-2", type: "page-break", order: 2 }),
      section({ id: "talent", type: "talent", order: 3 }),
    ]);

    expect(pages).toHaveLength(2);
    expect(pages[0].map((s) => s.id)).toEqual(["schedule"]);
    expect(pages[1].map((s) => s.id)).toEqual(["talent"]);
  });
});

