import { describe, expect, it } from "vitest";
import { projectMemberPath, projectMembersPath } from "../paths";

describe("paths - project members", () => {
  it("builds project member paths", () => {
    expect(projectMembersPath("p1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "p1",
      "members",
    ]);
    expect(projectMemberPath("p1", "u1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "p1",
      "members",
      "u1",
    ]);
  });
});

