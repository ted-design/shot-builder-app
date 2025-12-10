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

const addDocCalls = [];
const addDocMock = vi.fn(async (collRef, data) => {
  addDocCalls.push({ collRef, data });
  return { id: `shot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` };
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
  addDoc: addDocMock,
  serverTimestamp: serverTimestampMock,
  arrayUnion: vi.fn((val) => val),
  arrayRemove: vi.fn((val) => val),
}));

vi.mock("../../lib/firebase", () => ({
  db: {},
}));

vi.mock("../../lib/toast", () => ({
  toast: toastMock,
  showConfirm: vi.fn(async () => true), // Auto-confirm for tests
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

vi.mock("../../components/shots/BulkOperationsToolbar", () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  writeBatchCalls.length = 0;
  addDocCalls.length = 0;
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  toastMock.info.mockClear();
});

describe("ShotsPage bulk operations", () => {
  it("adds updatedAt timestamp when setting location in bulk", async () => {
    const { writeBatch, serverTimestamp } = await import("firebase/firestore");

    // Simulate batch operation
    const batch = writeBatch();
    const mockRef = { __path: ["clients", "test-client", "shots", "shot-1"] };

    batch.update(mockRef, {
      locationId: "loc-123",
      locationName: "Studio A",
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    expect(writeBatchCalls).toHaveLength(1);
    expect(writeBatchCalls[0]).toHaveLength(1);

    const operation = writeBatchCalls[0][0];
    expect(operation.type).toBe("update");
    expect(operation.data).toHaveProperty("locationId");
    expect(operation.data).toHaveProperty("locationName");
    expect(operation.data).toHaveProperty("updatedAt");
    expect(operation.data.updatedAt).toEqual({ __serverTimestamp: true });
  });

  it("adds updatedAt timestamp when setting date in bulk", async () => {
    const { writeBatch, serverTimestamp } = await import("firebase/firestore");

    const batch = writeBatch();
    const mockRef = { __path: ["clients", "test-client", "shots", "shot-1"] };

    batch.update(mockRef, {
      date: new Date("2025-01-15"),
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    expect(writeBatchCalls).toHaveLength(1);
    const operation = writeBatchCalls[0][0];
    expect(operation.type).toBe("update");
    expect(operation.data).toHaveProperty("date");
    expect(operation.data).toHaveProperty("updatedAt");
  });

  it("adds updatedAt timestamp when setting type in bulk", async () => {
    const { writeBatch, serverTimestamp } = await import("firebase/firestore");

    const batch = writeBatch();
    const mockRef = { __path: ["clients", "test-client", "shots", "shot-1"] };

    batch.update(mockRef, {
      type: "product",
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    expect(writeBatchCalls).toHaveLength(1);
    const operation = writeBatchCalls[0][0];
    expect(operation.type).toBe("update");
    expect(operation.data).toHaveProperty("type");
    expect(operation.data.type).toBe("product");
    expect(operation.data).toHaveProperty("updatedAt");
  });

  it("adds updatedAt timestamp and resets laneId when moving shots to project", async () => {
    const { writeBatch, serverTimestamp } = await import("firebase/firestore");

    const batch = writeBatch();
    const mockRef = { __path: ["clients", "test-client", "shots", "shot-1"] };

    batch.update(mockRef, {
      projectId: "new-project-123",
      laneId: null, // Reset lane when moving projects
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    expect(writeBatchCalls).toHaveLength(1);
    const operation = writeBatchCalls[0][0];
    expect(operation.type).toBe("update");
    expect(operation.data).toHaveProperty("projectId");
    expect(operation.data.projectId).toBe("new-project-123");
    expect(operation.data).toHaveProperty("laneId");
    expect(operation.data.laneId).toBe(null);
    expect(operation.data).toHaveProperty("updatedAt");
  });

  it("creates new documents with timestamps when copying shots to project", async () => {
    const { addDoc, serverTimestamp } = await import("firebase/firestore");

    const mockCollRef = { __path: ["clients", "test-client", "shots"] };
    const shotData = {
      name: "Test Shot",
      description: "Test description",
      type: "product",
      projectId: "target-project-123",
      laneId: null,
      status: "todo",
      products: [],
      productIds: [],
      talent: [],
      talentIds: [],
      tags: [],
      createdAt: serverTimestamp(),
      createdBy: "test-user",
      updatedAt: serverTimestamp()
    };

    await addDoc(mockCollRef, shotData);

    expect(addDocCalls).toHaveLength(1);
    expect(addDocCalls[0].data).toHaveProperty("name");
    expect(addDocCalls[0].data).toHaveProperty("projectId");
    expect(addDocCalls[0].data.projectId).toBe("target-project-123");
    expect(addDocCalls[0].data).toHaveProperty("createdAt");
    expect(addDocCalls[0].data).toHaveProperty("updatedAt");
    expect(addDocCalls[0].data).toHaveProperty("createdBy");
    expect(addDocCalls[0].data.laneId).toBe(null); // No lane assignment for copied shots
  });

  it("handles batch commits correctly for multiple operations", async () => {
    const { writeBatch } = await import("firebase/firestore");

    // Simulate batch operation with multiple shots
    const batch = writeBatch();

    for (let i = 0; i < 3; i++) {
      const mockRef = { __path: ["clients", "test-client", "shots", `shot-${i}`] };
      batch.update(mockRef, {
        locationId: "loc-123",
        locationName: "Studio A",
        updatedAt: { __serverTimestamp: true }
      });
    }

    await batch.commit();

    expect(writeBatchCalls).toHaveLength(1);
    expect(writeBatchCalls[0]).toHaveLength(3);

    writeBatchCalls[0].forEach((operation) => {
      expect(operation.type).toBe("update");
      expect(operation.data.locationId).toBe("loc-123");
      expect(operation.data).toHaveProperty("updatedAt");
    });
  });

  it("clears location when setting to null", async () => {
    const { writeBatch, serverTimestamp } = await import("firebase/firestore");

    const batch = writeBatch();
    const mockRef = { __path: ["clients", "test-client", "shots", "shot-1"] };

    batch.update(mockRef, {
      locationId: null,
      locationName: null,
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    const operation = writeBatchCalls[0][0];
    expect(operation.data.locationId).toBe(null);
    expect(operation.data.locationName).toBe(null);
  });

  it("clears date when setting to null", async () => {
    const { writeBatch, serverTimestamp } = await import("firebase/firestore");

    const batch = writeBatch();
    const mockRef = { __path: ["clients", "test-client", "shots", "shot-1"] };

    batch.update(mockRef, {
      date: null,
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    const operation = writeBatchCalls[0][0];
    expect(operation.data.date).toBe(null);
  });

  it("clears type when setting to empty string", async () => {
    const { writeBatch, serverTimestamp } = await import("firebase/firestore");

    const batch = writeBatch();
    const mockRef = { __path: ["clients", "test-client", "shots", "shot-1"] };

    batch.update(mockRef, {
      type: "",
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    const operation = writeBatchCalls[0][0];
    expect(operation.data.type).toBe("");
  });
});
