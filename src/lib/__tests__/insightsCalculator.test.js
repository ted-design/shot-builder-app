import { describe, expect, it } from "vitest";
import {
  calculateGroupedShotTotals,
  calculateTalentTotals,
  TALENT_UNASSIGNED_ID,
} from "../insightsCalculator";

describe("insightsCalculator", () => {
  it("calculates talent totals from object assignments", () => {
    const shots = [
      {
        id: "s1",
        talent: [
          { talentId: "t1", name: "Alpha" },
          { talentId: "t1", name: "Alpha" }, // duplicate should be ignored per shot
        ],
      },
      {
        id: "s2",
        talent: [
          { talentId: "t1", name: "Alpha" },
          { talentId: "t2", name: "Beta" },
        ],
      },
      { id: "s3", talent: [] },
    ];

    const talentLookup = {
      Alpha: { id: "t1", headshotPath: "alpha.jpg" },
      Beta: { id: "t2", headshotPath: "beta.jpg" },
    };

    const totals = calculateTalentTotals(shots, talentLookup);

    expect(totals).toEqual([
      { id: "t1", name: "Alpha", talentId: "t1", headshotPath: "alpha.jpg", total: 2 },
      { id: "t2", name: "Beta", talentId: "t2", headshotPath: "beta.jpg", total: 1 },
      {
        id: TALENT_UNASSIGNED_ID,
        name: "Unassigned",
        talentId: null,
        headshotPath: null,
        total: 1,
      },
    ]);
  });

  it("groups shots by talent names after normalisation", () => {
    const shotWithTalent = { id: "s1", talent: [{ talentId: "t1", name: "Gamma" }] };
    const shotWithIds = { id: "s2", talentIds: ["t2"] };
    const shotUnassigned = { id: "s3" };

    const groups = calculateGroupedShotTotals(
      [shotWithTalent, shotWithIds, shotUnassigned],
      "talent"
    );

    expect(groups).toEqual([
      { key: "Gamma", label: "Gamma", shotCount: 1, shots: [shotWithTalent] },
      { key: "t2", label: "t2", shotCount: 1, shots: [shotWithIds] },
      {
        key: "unassigned",
        label: "Unassigned Talent",
        shotCount: 1,
        shots: [shotUnassigned],
      },
    ]);
  });

  it("groups shots by status in defined order and labels missing values", () => {
    const shots = [
      { id: "s1", status: "complete" },
      { id: "s2", status: "todo" },
      { id: "s3", status: "in_progress" },
      { id: "s4" }, // no status
      { id: "s5", status: "custom" }, // unknown status
    ];

    const groups = calculateGroupedShotTotals(shots, "status");

    expect(groups).toEqual([
      { key: "todo", label: "To do", shotCount: 1, shots: [{ id: "s2", status: "todo" }] },
      {
        key: "in_progress",
        label: "In progress",
        shotCount: 1,
        shots: [{ id: "s3", status: "in_progress" }],
      },
      {
        key: "complete",
        label: "Complete",
        shotCount: 1,
        shots: [{ id: "s1", status: "complete" }],
      },
      {
        key: "custom",
        label: "custom",
        shotCount: 1,
        shots: [{ id: "s5", status: "custom" }],
      },
      {
        key: "no_status",
        label: "No status",
        shotCount: 1,
        shots: [{ id: "s4" }],
      },
    ]);
  });
});
