import { describe, expect, it } from "vitest";
import { buildCallSheetLayoutV2 } from "../callsheet/layoutV2";

describe("callsheet layout v2", () => {
  it("builds a default v2 layout with schedule fields (including products)", () => {
    const schedule = {
      columnConfig: [
        { key: "time", label: "Time", width: "md", visible: true, order: 0 },
        { key: "products", label: "Products", width: "md", visible: true, order: 5 },
        { key: "notes", label: "Notes", width: "hidden", visible: false, order: 7 },
      ],
    };

    const layout = buildCallSheetLayoutV2({ schedule, legacyCallSheetConfig: null });

    expect(layout.schemaVersion).toBe(2);
    expect(layout.header.preset).toBe("classic");
    expect(layout.header.center.items[0]?.value).toBe("@projectTitle");

    const scheduleSection = layout.sections.find((s) => s.type === "schedule");
    expect(scheduleSection).toBeTruthy();
    expect(scheduleSection?.fields.map((f) => f.id)).toEqual(["time", "products", "notes"]);
    expect(scheduleSection?.fields.find((f) => f.id === "products")?.enabled).toBe(true);
    expect(scheduleSection?.fields.find((f) => f.id === "notes")?.enabled).toBe(false);
    expect(scheduleSection?.fields.find((f) => f.id === "notes")?.width).toBe("hidden");
  });

  it("converts legacy sections isVisible to enabled", () => {
    const schedule = { columnConfig: [] };
    const legacy = {
      headerLayout: "classic",
      sections: [
        { id: "section-reminders", type: "reminders", isVisible: false, order: 2, config: {} },
      ],
      pageSize: "letter",
      spacing: "compact",
      timeFormat: "24h",
      temperatureFormat: "celsius",
      showFooterLogo: true,
      colors: { primary: "#111111", accent: "#222222", text: "#333333", background: "#ffffff" },
    };

    const layout = buildCallSheetLayoutV2({ schedule, legacyCallSheetConfig: legacy });
    expect(layout.sections).toHaveLength(1);
    expect(layout.sections[0].enabled).toBe(false);
    expect(layout.settings.timeFormat).toBe("24h");
    expect(layout.settings.tempFormat).toBe("celsius");
    expect(layout.settings.spacing).toBe("compact");
    expect(layout.settings.showFooterLogo).toBe(true);
    expect(layout.settings.pageSize.unit).toBe("inches");
  });
});

