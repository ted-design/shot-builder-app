import { describe, it, expect } from "vitest";
import { adaptUser } from "../adapter";

describe("adaptUser", () => {
  it("maps a Firebase user to the NavBar-friendly shape", () => {
    const u: any = {
      uid: "abc",
      displayName: "Ted",
      email: "ted@example.com",
      photoURL: "http://x/y.jpg",
      emailVerified: true,
      providerData: [{ providerId: "google.com" }, { providerId: "password" }],
    };
    const out = adaptUser(u);
    expect(out).toStrictEqual({
      id: "abc",
      name: "Ted",
      email: "ted@example.com",
      avatarUrl: "http://x/y.jpg",
      verified: true,
      providers: ["google.com", "password"],
    });
  });

  it("returns null for null/undefined input", () => {
    // @ts-expect-error intentional edge case
    expect(adaptUser(null)).toBeNull();
    // @ts-expect-error intentional edge case
    expect(adaptUser(undefined)).toBeNull();
  });

  it("handles missing optional fields safely", () => {
    const u: any = { uid: "x1", displayName: null, email: null, photoURL: null, providerData: [] };
    const out = adaptUser(u);
    expect(out).toStrictEqual({
      id: "x1",
      name: null,
      email: null,
      avatarUrl: null,
      verified: false,
      providers: [],
    });
  });
});
