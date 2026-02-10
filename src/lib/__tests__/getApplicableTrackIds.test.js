import { describe, expect, it } from "vitest";
import { getApplicableTrackIds } from "../callsheet/getApplicableTrackIds";

describe("getApplicableTrackIds", () => {
  const tracksById = new Map([
    ["shared", { id: "shared", scope: "shared", name: "Shared" }],
    ["primary", { id: "primary", scope: "lane", name: "Primary" }],
    ["track2", { id: "track2", scope: "lane", name: "Track 2" }],
  ]);

  it('treats trackId="shared" as shared-to-all', () => {
    const result = getApplicableTrackIds({ trackId: "shared" }, tracksById);
    expect(result.kind).toBe("all");
    expect(result.trackIds).toEqual(["primary", "track2"]);
  });

  it('treats trackId="all" as shared-to-all', () => {
    const result = getApplicableTrackIds({ trackId: "all" }, tracksById);
    expect(result.kind).toBe("all");
    expect(result.trackIds).toEqual(["primary", "track2"]);
  });

  it('gives shared-to-all precedence over appliesToTrackIds for trackId="all"', () => {
    const result = getApplicableTrackIds(
      { trackId: "all", appliesToTrackIds: ["primary"] },
      tracksById
    );
    expect(result.kind).toBe("all");
    expect(result.trackIds).toEqual(["primary", "track2"]);
  });
});

