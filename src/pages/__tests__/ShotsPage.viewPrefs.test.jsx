import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { __test__readStoredViewPrefs as readPrefs } from "../ShotsPage.jsx";

globalThis.React = React;

const STORAGE_KEY = "shots:viewPrefs";

describe("Shots view prefs persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads fieldOrder and lockedFields from storage and normalises", () => {
    const stored = {
      fieldOrder: ["tags", "name", "bogus", "status"],
      lockedFields: ["status", "unknown"],
      showTags: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const prefs = readPrefs();
    expect(Array.isArray(prefs.fieldOrder)).toBe(true);
    expect(prefs.fieldOrder[0]).toBe("tags");
    expect(prefs.fieldOrder[1]).toBe("name");
    // unknown entries are dropped, defaults appended
    expect(prefs.fieldOrder).toContain("image");

    expect(Array.isArray(prefs.lockedFields)).toBe(true);
    expect(prefs.lockedFields).toContain("status");
    expect(prefs.lockedFields).not.toContain("unknown");

    expect(prefs.showTags).toBe(false);
  });
});

