import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import LocationsPage from "../LocationsPage.jsx";

globalThis.React = React;

const createModalSpy = vi.fn();
const editModalSpy = vi.fn();

const mockLocations = [
  {
    id: "loc-001",
    data: () => ({
      name: "Studio A",
      street: "123 Main St",
      city: "Toronto",
      province: "ON",
      postal: "M5H 2N2",
      phone: "555-1234",
      notes: "Use back entrance",
      photoPath: "locations/loc-001.jpg",
    }),
  },
];

let collectionMock;
let docMock;
let orderByMock;
let queryMock;
let addDocMock;
let updateDocMock;
let deleteDocMock;
let serverTimestampMock;
let onSnapshotMock;

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
  collection: (...args) => collectionMock(...args),
  doc: (...args) => docMock(...args),
  orderBy: (...args) => orderByMock(...args),
  query: (...args) => queryMock(...args),
  onSnapshot: (...args) => onSnapshotMock(...args),
  addDoc: (...args) => addDocMock(...args),
  updateDoc: (...args) => updateDocMock(...args),
  deleteDoc: (...args) => deleteDocMock(...args),
  serverTimestamp: (...args) => serverTimestampMock(...args),
}));

beforeEach(() => {
  collectionMock = vi.fn((db, ...segments) => ({ __path: segments }));
  docMock = vi.fn((db, ...segments) => ({ __path: segments }));
  orderByMock = vi.fn(() => ({}));
  queryMock = vi.fn((ref) => ref);
  addDocMock = vi.fn(async () => ({ id: "new-location" }));
  updateDocMock = vi.fn(async () => {});
  deleteDocMock = vi.fn(async () => {});
  serverTimestampMock = vi.fn(() => "ts");
  onSnapshotMock = vi.fn((_ref, onNext) => {
    onNext?.({ docs: mockLocations });
    return () => {};
  });
});

vi.mock("../../lib/firebase", () => ({
  db: {},
  uploadImageFile: vi.fn(async () => ({ path: "uploaded/location" })),
  deleteImageByPath: vi.fn(async () => {}),
}));

vi.mock("../../lib/firestoreWrites", () => ({
  writeDoc: vi.fn(async (_label, task) => task()),
}));

vi.mock("../../lib/firebaseErrors", () => ({
  describeFirebaseError: (error, fallback) => ({ code: error?.code || "unknown", message: error?.message || fallback }),
}));

vi.mock("../../lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    clientId: "test-client",
    role: "producer",
    user: { uid: "tester" },
    claims: {},
  }),
}));

vi.mock("../../components/locations/LocationCreateModal.jsx", () => ({
  default: (props) => {
    createModalSpy(props);
    return props.open ? <div data-testid="locations-create-modal" /> : null;
  },
}));

vi.mock("../../components/locations/LocationEditModal.jsx", () => ({
  default: (props) => {
    editModalSpy(props);
    return props.open ? <div data-testid="locations-edit-modal" /> : null;
  },
}));

vi.mock("../../components/Thumb.jsx", () => ({
  default: ({ alt }) => <div data-testid={`thumb-${alt || "location"}`} />,
}));

afterEach(() => {
  cleanup();
  createModalSpy.mockClear();
  editModalSpy.mockClear();
  collectionMock?.mockClear();
  docMock?.mockClear();
  orderByMock?.mockClear();
  queryMock?.mockClear();
  onSnapshotMock?.mockClear();
});

describe("LocationsPage", () => {

  const getLatestCreateModalProps = () => {
    const calls = createModalSpy.mock.calls;
    return calls.length ? calls[calls.length - 1][0] : undefined;
  };

  const getLatestEditModalProps = () => {
    const calls = editModalSpy.mock.calls;
    return calls.length ? calls[calls.length - 1][0] : undefined;
  };

  it("shows the create card and opens the modal when requested", async () => {
    render(<LocationsPage />);

    await waitFor(() => expect(screen.getByText("Studio A")).toBeInTheDocument());

    expect(getLatestCreateModalProps()?.open).toBe(false);

    fireEvent.click(screen.getByText("Create location"));

    await waitFor(() => expect(getLatestCreateModalProps()?.open).toBe(true));
  });

  it("closes the create modal and opens edit when selecting a location", async () => {
    render(<LocationsPage />);

    await waitFor(() => expect(screen.getByText("Studio A")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Create location"));
    await waitFor(() => expect(getLatestCreateModalProps()?.open).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    await waitFor(() => expect(getLatestEditModalProps()?.open).toBe(true));
    expect(getLatestEditModalProps()?.location?.id).toBe("loc-001");
    expect(getLatestCreateModalProps()?.open).toBe(false);
  });
});
