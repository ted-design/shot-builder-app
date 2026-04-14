import { describe, expect, test } from "vitest";
import { joinNameParts, normalizeHumanName, splitFullName } from "../personName";

describe("personName helpers", () => {
  test("normalizeHumanName trims and collapses whitespace", () => {
    expect(normalizeHumanName("  Ashley   Smith  ")).toBe("Ashley Smith");
  });

  test("splitFullName splits on last space", () => {
    expect(splitFullName("Ashley Smith")).toEqual({ firstName: "Ashley", lastName: "Smith" });
  });

  test("splitFullName treats single token as first name", () => {
    expect(splitFullName("Prince")).toEqual({ firstName: "Prince", lastName: "" });
  });

  test("splitFullName collapses multiple spaces", () => {
    expect(splitFullName("Mary   Jane   Watson")).toEqual({ firstName: "Mary Jane", lastName: "Watson" });
  });

  test("joinNameParts rejoins with trimming", () => {
    expect(joinNameParts("  Mary Jane  ", "  Watson ")).toBe("Mary Jane Watson");
  });
});

