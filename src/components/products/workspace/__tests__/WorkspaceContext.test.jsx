import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { WorkspaceContext, useWorkspace, WORKSPACE_SECTIONS } from "../WorkspaceContext";

describe("WorkspaceContext", () => {
  describe("useWorkspace", () => {
    it("throws error when used outside provider", () => {
      // Suppress console.error for this test since React will log the error
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWorkspace());
      }).toThrow("useWorkspace must be used within WorkspaceProvider");

      consoleSpy.mockRestore();
    });

    it("returns context value when used within provider", () => {
      const mockContextValue = {
        activeSection: "colorways",
        setActiveSection: vi.fn(),
        selectedColorwayId: "sku-123",
        setSelectedColorwayId: vi.fn(),
      };

      const wrapper = ({ children }) => (
        <WorkspaceContext.Provider value={mockContextValue}>
          {children}
        </WorkspaceContext.Provider>
      );

      const { result } = renderHook(() => useWorkspace(), { wrapper });

      expect(result.current.activeSection).toBe("colorways");
      expect(result.current.selectedColorwayId).toBe("sku-123");
      expect(typeof result.current.setActiveSection).toBe("function");
      expect(typeof result.current.setSelectedColorwayId).toBe("function");
    });
  });

  describe("WORKSPACE_SECTIONS", () => {
    it("contains all expected sections", () => {
      const sectionIds = WORKSPACE_SECTIONS.map((s) => s.id);
      expect(sectionIds).toContain("overview");
      expect(sectionIds).toContain("colorways");
      expect(sectionIds).toContain("samples");
      expect(sectionIds).toContain("assets");
      expect(sectionIds).toContain("activity");
    });

    it("has label and description for each section", () => {
      WORKSPACE_SECTIONS.forEach((section) => {
        expect(section.label).toBeDefined();
        expect(typeof section.label).toBe("string");
        expect(section.description).toBeDefined();
        expect(typeof section.description).toBe("string");
      });
    });

    it("has iconName for each section", () => {
      WORKSPACE_SECTIONS.forEach((section) => {
        expect(section.iconName).toBeDefined();
        expect(typeof section.iconName).toBe("string");
      });
    });

    it("has countKey for sections with counts", () => {
      const sectionsWithCounts = WORKSPACE_SECTIONS.filter(
        (s) => s.id !== "overview"
      );
      sectionsWithCounts.forEach((section) => {
        expect(section.countKey).toBeDefined();
      });
    });

    it("overview section does not have countKey", () => {
      const overview = WORKSPACE_SECTIONS.find((s) => s.id === "overview");
      expect(overview.countKey).toBeUndefined();
    });
  });
});
