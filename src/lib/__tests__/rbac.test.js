import { describe, expect, it } from "vitest";
import { ROLE, resolveRoleValue, normalizeRole, resolveEffectiveRole } from "../rbac";

describe("resolveRoleValue", () => {
  it("returns strings untouched", () => {
    expect(resolveRoleValue("producer")).toBe("producer");
  });

  it("returns the first resolvable entry in arrays", () => {
    expect(resolveRoleValue([null, "crew"])).toBe("crew");
    expect(resolveRoleValue([false, ["admin"]])).toBe("admin");
  });

  it("returns nested role objects", () => {
    const payload = { role: { default: "Producer" } };
    expect(resolveRoleValue(payload)).toBe("Producer");
  });

  it("prefers explicit role before fallback keys", () => {
    const payload = { role: "crew", default: "viewer", type: "admin" };
    expect(resolveRoleValue(payload)).toBe("crew");
  });

  it("resolves default and type fields when role is missing", () => {
    expect(resolveRoleValue({ role: null, default: "warehouse" })).toBe("warehouse");
    expect(resolveRoleValue({ type: "Admin" })).toBe("Admin");
  });

  it("returns null when nothing can be resolved", () => {
    expect(resolveRoleValue({ role: null, default: null })).toBeNull();
    expect(resolveRoleValue(undefined)).toBeNull();
  });

  it("bails out on circular references", () => {
    const payload = {};
    payload.self = payload;
    expect(resolveRoleValue(payload)).toBeNull();
  });
});

describe("normalizeRole", () => {
  it("lowercases resolved roles", () => {
    expect(normalizeRole("Producer")).toBe("producer");
  });

  it("returns null for invalid values", () => {
    expect(normalizeRole({})).toBeNull();
  });
});

describe("resolveEffectiveRole", () => {
  const projectRoles = {
    featured: "producer",
    archived: { role: null, default: "crew" },
  };

  it("prefers project-specific roles", () => {
    expect(resolveEffectiveRole("viewer", projectRoles, "featured")).toBe("producer");
  });

  it("falls back to normalized global role", () => {
    expect(resolveEffectiveRole("Admin", projectRoles, "missing")).toBe("admin");
  });

  it("defaults to viewer when nothing resolves", () => {
    expect(resolveEffectiveRole(null, {}, "missing")).toBe(ROLE.VIEWER);
  });

  it("uses project fallback when role field is nested", () => {
    expect(resolveEffectiveRole(null, projectRoles, "archived")).toBe("crew");
  });
});
