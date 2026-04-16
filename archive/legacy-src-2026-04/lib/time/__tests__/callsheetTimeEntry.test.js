import { describe, expect, it } from "vitest";
import { classifyCallsheetTimeInput } from "../callsheetTimeEntry";

describe("classifyCallsheetTimeInput", () => {
  it("classifies empty values", () => {
    expect(classifyCallsheetTimeInput("")).toEqual({
      kind: "empty",
      canonical: null,
      text: null,
    });
    expect(classifyCallsheetTimeInput("   ")).toEqual({
      kind: "empty",
      canonical: null,
      text: null,
    });
  });

  it("normalizes valid times to canonical HH:MM", () => {
    expect(classifyCallsheetTimeInput("6:17 AM")).toEqual({
      kind: "time",
      canonical: "06:17",
      text: null,
    });
    expect(classifyCallsheetTimeInput("6:17")).toEqual({
      kind: "time",
      canonical: "06:17",
      text: null,
    });
    expect(classifyCallsheetTimeInput("06:17")).toEqual({
      kind: "time",
      canonical: "06:17",
      text: null,
    });
    expect(classifyCallsheetTimeInput("14:30")).toEqual({
      kind: "time",
      canonical: "14:30",
      text: null,
    });
    expect(classifyCallsheetTimeInput("0:05")).toEqual({
      kind: "time",
      canonical: "00:05",
      text: null,
    });
  });

  it("rejects invalid time-like values", () => {
    expect(classifyCallsheetTimeInput("24:00")).toEqual({
      kind: "invalid-time",
      canonical: null,
      text: null,
    });
    expect(classifyCallsheetTimeInput("12:75")).toEqual({
      kind: "invalid-time",
      canonical: null,
      text: null,
    });
  });

  it("supports text override only when allowText is true", () => {
    expect(classifyCallsheetTimeInput("OFF", { allowText: true })).toEqual({
      kind: "text",
      canonical: null,
      text: "OFF",
    });
    expect(classifyCallsheetTimeInput("OFF")).toEqual({
      kind: "invalid-time",
      canonical: null,
      text: null,
    });
  });
});
