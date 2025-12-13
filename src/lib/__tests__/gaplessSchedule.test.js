import { describe, it, expect } from "vitest";
import {
  buildGaplessDurationChangeUpdates,
  buildGaplessReorderUpdates,
  buildGaplessTimeChangeUpdates,
} from "../gaplessSchedule";

describe("gaplessSchedule helpers", () => {
  it("packs following entries when duration changes", () => {
    const entries = [
      { id: "a", trackId: "photo", startTime: "08:00", duration: 30, order: 0 },
      { id: "b", trackId: "photo", startTime: "08:30", duration: 30, order: 1 },
      { id: "c", trackId: "photo", startTime: "09:00", duration: 30, order: 2 },
    ];

    const updates = buildGaplessDurationChangeUpdates(entries, "b", 45);
    expect(updates).toEqual(
      expect.arrayContaining([
        { entryId: "b", duration: 45 },
        { entryId: "c", startTime: "09:15" },
      ])
    );
  });

  it("packs single-track applied shared banners with that track", () => {
    const entries = [
      { id: "v1", trackId: "video", startTime: "08:30", duration: 30, order: 0, type: "shot" },
      {
        id: "reset",
        trackId: "shared",
        type: "custom",
        startTime: "08:45",
        duration: 25,
        order: 0,
        appliesToTrackIds: ["video"],
        customData: { category: "setup", title: "reset" },
      },
    ];

    const updates = buildGaplessDurationChangeUpdates(entries, "v1", 20);
    expect(updates).toEqual(
      expect.arrayContaining([
        { entryId: "v1", duration: 20 },
        { entryId: "reset", startTime: "08:50" },
      ])
    );
  });

  it("shifts an entire track when the first start time changes", () => {
    const entries = [
      { id: "a", trackId: "photo", startTime: "08:00", duration: 30, order: 0 },
      { id: "b", trackId: "photo", startTime: "08:30", duration: 30, order: 1 },
    ];

    const updates = buildGaplessTimeChangeUpdates(entries, "a", "08:15");
    expect(updates).toEqual(
      expect.arrayContaining([
        { entryId: "a", startTime: "08:15" },
        { entryId: "b", startTime: "08:45" },
      ])
    );
  });

  it("adjusts the previous duration when a middle start time changes", () => {
    const entries = [
      { id: "a", trackId: "photo", startTime: "08:00", duration: 30, order: 0 },
      { id: "b", trackId: "photo", startTime: "08:30", duration: 30, order: 1 },
      { id: "c", trackId: "photo", startTime: "09:00", duration: 30, order: 2 },
    ];

    const updates = buildGaplessTimeChangeUpdates(entries, "b", "08:45");
    expect(updates).toEqual(
      expect.arrayContaining([
        { entryId: "a", duration: 45 },
        { entryId: "b", startTime: "08:45" },
        { entryId: "c", startTime: "09:15" },
      ])
    );
  });

  it("reorders within a track and repacks from the track anchor", () => {
    const entries = [
      { id: "a", trackId: "photo", startTime: "08:00", duration: 30, order: 0 },
      { id: "b", trackId: "photo", startTime: "08:30", duration: 30, order: 1 },
      { id: "c", trackId: "photo", startTime: "09:00", duration: 30, order: 2 },
      { id: "x", trackId: "video", startTime: "08:00", duration: 20, order: 0 },
    ];

    const updates = buildGaplessReorderUpdates(entries, "photo", ["a", "c", "b"], { anchorStartMinutes: 480 });
    expect(updates).toEqual(
      expect.arrayContaining([
        { entryId: "c", startTime: "08:30", order: 1 },
        { entryId: "b", startTime: "09:00", order: 2 },
      ])
    );
  });
});
