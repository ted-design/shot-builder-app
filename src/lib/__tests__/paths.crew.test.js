import { describe, expect, it } from "vitest";
import { crewMemberPath, crewPath } from "../paths";

describe("paths - crew", () => {
  it("builds crew paths", () => {
    expect(crewPath("c1")).toEqual(["clients", "c1", "crew"]);
    expect(crewMemberPath("m1", "c1")).toEqual(["clients", "c1", "crew", "m1"]);
  });
});

