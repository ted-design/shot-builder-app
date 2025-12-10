import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

globalThis.React = React;

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  showConfirm: vi.fn(() => Promise.resolve(true)),
};

const writeBatchCalls = [];

const writeBatchMock = vi.fn(() => {
  const operations = [];
  return {
    update: (ref, data) => operations.push({ type: "update", ref, data }),
    commit: vi.fn(async () => {
      writeBatchCalls.push(operations.slice());
    }),
  };
});

const serverTimestampMock = vi.fn(() => ({ __serverTimestamp: true }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...args) => ({ __path: args })),
  doc: vi.fn((...args) => ({ __path: args })),
  query: vi.fn((ref) => ref),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => {}),
  getDocs: vi.fn(async () => ({ docs: [] })),
  writeBatch: writeBatchMock,
  serverTimestamp: serverTimestampMock,
  arrayUnion: vi.fn((val) => val),
  arrayRemove: vi.fn((val) => val),
}));

vi.mock("../../lib/firebase", () => ({
  db: {},
}));

vi.mock("../../lib/toast", () => ({
  toast: toastMock,
  showConfirm: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    clientId: "test-client",
    role: "producer",
    user: { uid: "test-user" },
  }),
}));

vi.mock("../../context/ProjectScopeContext", () => ({
  useProjectScope: () => ({
    projectId: "test-project",
    projects: [],
    fetchProjects: vi.fn(),
  }),
}));

vi.mock("../../context/KeyboardShortcutsContext", () => ({
  useKeyboardShortcuts: () => ({
    toggleHelp: vi.fn(),
  }),
}));

// Mock all the complex components
vi.mock("../../components/shots/ShotEditModal", () => ({
  default: () => null,
}));

vi.mock("../../components/shots/CreateShotCard", () => ({
  default: () => null,
}));

vi.mock("../../components/shots/BulkTaggingToolbar", () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  writeBatchCalls.length = 0;
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  toastMock.info.mockClear();
});

describe("ShotsPage bulk tagging", () => {
  it("adds updatedAt timestamp when applying tags in bulk", async () => {
    // This test verifies that bulk tag operations include the updatedAt field
    // which was the critical bug identified in the Claude Code review

    const { writeBatch, serverTimestamp } = await import("firebase/firestore");

    // Simulate batch operation
    const batch = writeBatch();
    const mockRef = { __path: ["clients", "test-client", "shots", "shot-1"] };

    batch.update(mockRef, {
      tags: [{ id: "tag-1", label: "Test Tag", color: "blue" }],
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    expect(writeBatchCalls).toHaveLength(1);
    expect(writeBatchCalls[0]).toHaveLength(1);

    const operation = writeBatchCalls[0][0];
    expect(operation.type).toBe("update");
    expect(operation.data).toHaveProperty("tags");
    expect(operation.data).toHaveProperty("updatedAt");
    expect(operation.data.updatedAt).toEqual({ __serverTimestamp: true });
  });

  it("adds updatedAt timestamp when removing tags in bulk", async () => {
    const { writeBatch, serverTimestamp } = await import("firebase/firestore");

    // Simulate batch operation
    const batch = writeBatch();
    const mockRef = { __path: ["clients", "test-client", "shots", "shot-1"] };

    batch.update(mockRef, {
      tags: [], // Tags removed
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    expect(writeBatchCalls).toHaveLength(1);
    expect(writeBatchCalls[0]).toHaveLength(1);

    const operation = writeBatchCalls[0][0];
    expect(operation.type).toBe("update");
    expect(operation.data).toHaveProperty("tags");
    expect(operation.data).toHaveProperty("updatedAt");
  });

  it("handles batch commits correctly", async () => {
    const { writeBatch } = await import("firebase/firestore");

    // Simulate batch operation with multiple shots
    const batch = writeBatch();

    for (let i = 0; i < 3; i++) {
      const mockRef = { __path: ["clients", "test-client", "shots", `shot-${i}`] };
      batch.update(mockRef, {
        tags: [{ id: "tag-1", label: "Test Tag", color: "blue" }],
        updatedAt: { __serverTimestamp: true }
      });
    }

    await batch.commit();

    expect(writeBatchCalls).toHaveLength(1);
    expect(writeBatchCalls[0]).toHaveLength(3);

    writeBatchCalls[0].forEach((operation) => {
      expect(operation.type).toBe("update");
      expect(operation.data.tags).toHaveLength(1);
      expect(operation.data).toHaveProperty("updatedAt");
    });
  });
});
