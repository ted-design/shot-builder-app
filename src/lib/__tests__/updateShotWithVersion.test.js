/**
 * Tests for updateShotWithVersion helper
 *
 * Verifies that the centralized shot update function:
 * 1. Calls Firestore updateDoc with correct payload
 * 2. Calls createVersionSnapshot with correct args (non-blocking)
 * 3. Does not throw when version snapshot fails
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase modules before importing the module under test
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
  doc: vi.fn((...args) => args.join("/")),
  updateDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
}));

vi.mock("../firebase", () => ({
  db: "mock-db",
}));

vi.mock("../paths", () => ({
  shotsPath: vi.fn((clientId) => ["clients", clientId, "shots"]),
}));

vi.mock("../versionLogger", () => ({
  createVersionSnapshot: vi.fn(() => Promise.resolve("mock-version-id")),
}));

import { updateShotWithVersion } from "../updateShotWithVersion";
import { updateDoc, doc } from "firebase/firestore";
import { createVersionSnapshot } from "../versionLogger";

describe("updateShotWithVersion", () => {
  const mockUser = {
    uid: "user-1",
    displayName: "Test User",
    email: "test@example.com",
    photoURL: null,
  };

  const mockShot = {
    id: "shot-1",
    name: "Test Shot",
    status: "draft",
    looks: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls updateDoc with patch + updatedAt + updatedBy", async () => {
    await updateShotWithVersion({
      clientId: "client-1",
      shotId: "shot-1",
      patch: { status: "approved" },
      shot: mockShot,
      user: mockUser,
      source: "test",
    });

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [, payload] = updateDoc.mock.calls[0];
    expect(payload.status).toBe("approved");
    expect(payload.updatedAt).toBe("SERVER_TIMESTAMP");
    expect(payload.updatedBy).toBe("user-1");
  });

  it("calls createVersionSnapshot with previousData and currentData", async () => {
    await updateShotWithVersion({
      clientId: "client-1",
      shotId: "shot-1",
      patch: { name: "New Name" },
      shot: mockShot,
      user: mockUser,
      source: "test",
    });

    // Wait for the non-blocking .then() to resolve
    await vi.waitFor(() => {
      expect(createVersionSnapshot).toHaveBeenCalledTimes(1);
    });

    const [clientId, entityType, entityId, prevData, currData, user, changeType] =
      createVersionSnapshot.mock.calls[0];

    expect(clientId).toBe("client-1");
    expect(entityType).toBe("shots");
    expect(entityId).toBe("shot-1");
    expect(prevData).toEqual({ id: "shot-1", ...mockShot });
    expect(currData).toEqual({ id: "shot-1", ...mockShot, name: "New Name" });
    expect(user).toBe(mockUser);
    expect(changeType).toBe("update");
  });

  it("does not throw when version snapshot fails", async () => {
    createVersionSnapshot.mockRejectedValueOnce(new Error("Version write failed"));

    // Should not throw
    await expect(
      updateShotWithVersion({
        clientId: "client-1",
        shotId: "shot-1",
        patch: { status: "approved" },
        shot: mockShot,
        user: mockUser,
        source: "test",
      })
    ).resolves.toBeUndefined();

    // updateDoc should still have been called
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });

  it("throws when clientId or shotId is missing", async () => {
    await expect(
      updateShotWithVersion({
        clientId: "",
        shotId: "shot-1",
        patch: { status: "approved" },
        shot: mockShot,
        user: mockUser,
      })
    ).rejects.toThrow("Missing clientId or shotId");

    await expect(
      updateShotWithVersion({
        clientId: "client-1",
        shotId: "",
        patch: { status: "approved" },
        shot: mockShot,
        user: mockUser,
      })
    ).rejects.toThrow("Missing clientId or shotId");
  });

  it("skips version snapshot when user is null", async () => {
    await updateShotWithVersion({
      clientId: "client-1",
      shotId: "shot-1",
      patch: { status: "approved" },
      shot: mockShot,
      user: null,
      source: "test",
    });

    expect(updateDoc).toHaveBeenCalledTimes(1);
    // updatedBy should NOT be set
    const [, payload] = updateDoc.mock.calls[0];
    expect(payload.updatedBy).toBeUndefined();

    // Version snapshot should NOT be called
    expect(createVersionSnapshot).not.toHaveBeenCalled();
  });

  it("skips version snapshot when shot is null", async () => {
    await updateShotWithVersion({
      clientId: "client-1",
      shotId: "shot-1",
      patch: { status: "approved" },
      shot: null,
      user: mockUser,
      source: "test",
    });

    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(createVersionSnapshot).not.toHaveBeenCalled();
  });
});
