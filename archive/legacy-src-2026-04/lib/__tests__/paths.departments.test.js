import { describe, expect, it } from "vitest";
import {
  departmentPath,
  departmentPositionPath,
  departmentPositionsPath,
  departmentsPath,
  projectDepartmentPath,
  projectDepartmentPositionPath,
  projectDepartmentPositionsPath,
  projectDepartmentsPath,
} from "../paths";

describe("paths - departments", () => {
  it("builds org department paths", () => {
    expect(departmentsPath("c1")).toEqual(["clients", "c1", "departments"]);
    expect(departmentPath("d1", "c1")).toEqual(["clients", "c1", "departments", "d1"]);
    expect(departmentPositionsPath("d1", "c1")).toEqual([
      "clients",
      "c1",
      "departments",
      "d1",
      "positions",
    ]);
    expect(departmentPositionPath("d1", "p1", "c1")).toEqual([
      "clients",
      "c1",
      "departments",
      "d1",
      "positions",
      "p1",
    ]);
  });

  it("builds project department paths", () => {
    expect(projectDepartmentsPath("proj1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "proj1",
      "departments",
    ]);
    expect(projectDepartmentPath("proj1", "d1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "proj1",
      "departments",
      "d1",
    ]);
    expect(projectDepartmentPositionsPath("proj1", "d1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "proj1",
      "departments",
      "d1",
      "positions",
    ]);
    expect(projectDepartmentPositionPath("proj1", "d1", "p1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "proj1",
      "departments",
      "d1",
      "positions",
      "p1",
    ]);
  });
});

