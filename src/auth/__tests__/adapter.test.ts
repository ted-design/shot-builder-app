import { describe, it, expect } from "vitest";
import { adaptUser } from "../adapter";

describe("adaptUser", () => {
  it("maps firebase user to nav user shape", () => {
    const u: any = {
      uid: "abc",
      displayName: "Ted",
      email: "ted@example.com",
      photoURL: "http://x/y.jpg",
      emailVerified: true,
      providerData: [{ providerId: "google.com" }],
    };
    expect(adaptUser(u)).toEqual({
      id: "abc",
      name: "Ted",
      email: "ted@example.com",
      avatarUrl: "http://x/y.jpg",
      verified: true,
      providers: ["google.com"],
    });
  });

  it("handles null/undefined user", () => {
    // @ts-expect-error testing null
    expect(adaptUser(null)).toBeNull();
    // @ts-expect-error testing undefined
    expect(adaptUser(undefined)).toBeNull();
  });
});

