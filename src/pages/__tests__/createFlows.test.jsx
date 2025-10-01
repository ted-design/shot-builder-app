import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";

globalThis.React = React;

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

const authState = {
  user: { uid: "test-user" },
  role: "producer",
  claims: { role: "producer", clientId: "unbound-merino" },
  ready: true,
};

const snapshotData = new Map();
const addDocCalls = [];
let pendingAddDocError = null;

const updateDocMock = vi.fn(async () => {});
const deleteDocMock = vi.fn(async () => {});
const getDocsMock = vi.fn(async () => createSnapshot("clients/unbound-merino/productFamilies"));
const arrayUnionMock = vi.fn((value) => ({ __op: "arrayUnion", value }));
const arrayRemoveMock = vi.fn((value) => ({ __op: "arrayRemove", value }));

class FakeTimestamp {
  constructor(date) {
    this._date = date;
  }

  toDate() {
    return this._date;
  }

  static fromDate(date) {
    return new FakeTimestamp(date);
  }
}

const pathKey = (segments) => (Array.isArray(segments) ? segments.join("/") : "");

function setSnapshot(segments, docs) {
  snapshotData.set(
    pathKey(segments),
    docs.map((entry) => ({ id: entry.id, data: entry.data }))
  );
}

function getPath(ref) {
  if (!ref) return [];
  if (Array.isArray(ref)) return ref;
  if (ref.__path) return ref.__path;
  if (ref.__ref) return getPath(ref.__ref);
  return [];
}

function createSnapshot(path) {
  const docs = snapshotData.get(path) || [];
  return {
    docs: docs.map((doc) => ({
      id: doc.id,
      data: () => ({ ...doc.data }),
    })),
  };
}

const onSnapshotMock = vi.fn((ref, onNext, onError) => {
  try {
    const key = pathKey(getPath(ref));
    if (typeof onNext === "function") {
      onNext(createSnapshot(key));
    }
  } catch (error) {
    if (typeof onError === "function") {
      onError(error);
    }
  }
  return () => {};
});

const addDocMock = vi.fn(async (collectionRef, data) => {
  addDocCalls.push({ path: [...collectionRef.__path], data });
  if (pendingAddDocError) {
    const err = pendingAddDocError;
    pendingAddDocError = null;
    throw err;
  }
  const docId = `doc-${addDocCalls.length}`;
  return { id: docId, __path: [...collectionRef.__path, docId] };
});

const collapseArgs = (maybeDb, segments) => (segments.length ? segments : Array.isArray(maybeDb) ? maybeDb : []);

const collectionMock = vi.fn((maybeDb, ...segments) => ({ __path: collapseArgs(maybeDb, segments) }));
const docMock = vi.fn((maybeDb, ...segments) => ({ __path: collapseArgs(maybeDb, segments) }));
const queryMock = vi.fn((ref, ...clauses) => ({ __path: getPath(ref), __ref: ref, __clauses: clauses }));
const orderByMock = vi.fn((...args) => ({ __orderBy: args }));
const whereMock = vi.fn((...args) => ({ __where: args }));

vi.mock("firebase/firestore", () => ({
  collection: collectionMock,
  doc: docMock,
  query: queryMock,
  orderBy: orderByMock,
  where: whereMock,
  getDocs: getDocsMock,
  onSnapshot: onSnapshotMock,
  addDoc: addDocMock,
  updateDoc: updateDocMock,
  deleteDoc: deleteDocMock,
  serverTimestamp: () => "__server_timestamp__",
  Timestamp: FakeTimestamp,
  arrayUnion: (...args) => arrayUnionMock(...args),
  arrayRemove: (...args) => arrayRemoveMock(...args),
}));

vi.mock("firebase/storage", () => ({
  getDownloadURL: vi.fn(() => Promise.reject(new Error("storage disabled in tests"))),
  ref: vi.fn(() => ({})),
}));

vi.mock("../../lib/firebase", () => ({
  db: {},
  uploadImageFile: vi.fn(async () => ({ downloadURL: "https://example.com/test.jpg", path: "images/test" })),
  deleteImageByPath: vi.fn(async () => {}),
  auth: { currentUser: { uid: "test-user", getIdToken: vi.fn(() => Promise.resolve()) } },
}));

vi.mock("../../lib/toast", () => ({ toast: toastMock }));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("../../components/shots/ShotProductsEditor", () => ({
  default: () => <div data-testid="shot-products-editor" />,
}));

vi.mock("../../components/shots/TalentMultiSelect", () => ({
  default: ({ isDisabled }) => (
    <div data-testid="talent-multiselect" data-disabled={isDisabled} />
  ),
}));

function resetSnapshotData() {
  snapshotData.clear();
  setSnapshot([
    "clients",
    "unbound-merino",
    "talent",
  ], [
    { id: "tal-1", data: { name: "River Song", firstName: "River", lastName: "Song" } },
  ]);
  setSnapshot([
    "clients",
    "unbound-merino",
    "locations",
  ], [
    { id: "loc-1", data: { name: "Main Stage" } },
  ]);
  setSnapshot([
    "clients",
    "unbound-merino",
    "shots",
  ], []);
  setSnapshot([
    "clients",
    "unbound-merino",
    "productFamilies",
  ], []);
}

beforeEach(() => {
  vi.clearAllMocks();
  addDocCalls.length = 0;
  pendingAddDocError = null;
  resetSnapshotData();
  authState.user = { uid: "test-user" };
  authState.role = "producer";
  authState.claims = { role: "producer", clientId: "unbound-merino" };
  getDocsMock.mockResolvedValue(createSnapshot("clients/unbound-merino/productFamilies"));
});

afterEach(() => {
  cleanup();
});

describe("Create flows", () => {
  it("creates talent at the client collection and shows a success toast", async () => {
    const { default: TalentPage } = await import("../TalentPage.jsx");
    render(<TalentPage />);

    fireEvent.click(screen.getByRole("button", { name: "New talent" }));

    const modal = await screen.findByRole("dialog", { name: /create talent/i });
    const firstNameInput = within(modal).getByLabelText("First name");
    fireEvent.change(firstNameInput, { target: { value: "Amelia" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Create talent" }));

    await waitFor(() => expect(addDocCalls.length).toBe(1));
    expect(addDocCalls[0].path).toEqual(["clients", "unbound-merino", "talent"]);
    expect(addDocCalls[0].data.createdBy).toBe("test-user");
    expect(toastMock.success).toHaveBeenCalledWith("Amelia was added to talent.");
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("surfaces Firestore errors with path information for talent create", async () => {
    const failure = Object.assign(new Error("Missing or insufficient permissions."), {
      code: "permission-denied",
      message: "Missing or insufficient permissions.",
    });
    pendingAddDocError = failure;
    const { default: TalentPage } = await import("../TalentPage.jsx");
    render(<TalentPage />);

    fireEvent.click(screen.getByRole("button", { name: "New talent" }));

    const modal = await screen.findByRole("dialog", { name: /create talent/i });
    fireEvent.change(within(modal).getByLabelText("First name"), { target: { value: "Donna" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Create talent" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(addDocCalls[0].path).toEqual(["clients", "unbound-merino", "talent"]);
    const firstError = toastMock.error.mock.calls[0][0];
    expect(firstError.description).toContain("permission-denied");
    expect(firstError.description).toContain("/clients/unbound-merino/talent");
  });

  it("creates location at the client collection and shows a success toast", async () => {
    const { default: LocationsPage } = await import("../LocationsPage.jsx");
    render(<LocationsPage />);

    fireEvent.change(screen.getByPlaceholderText("Location name"), {
      target: { value: "Warehouse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Location" }));

    await waitFor(() => expect(addDocCalls.length).toBe(1));
    expect(addDocCalls[0].path).toEqual(["clients", "unbound-merino", "locations"]);
    expect(addDocCalls[0].data.createdBy).toBe("test-user");
    expect(toastMock.success).toHaveBeenCalledWith("Warehouse was added to locations.");
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("creates shot at the client collection with the active project id", async () => {
    const { default: ShotsPage } = await import("../ShotsPage.jsx");
    render(<ShotsPage />);

    fireEvent.click(screen.getByRole("button", { name: "New shot" }));

    const modal = await screen.findByRole("dialog", { name: /create shot/i });
    const [nameInput] = within(modal).getAllByRole("textbox");
    fireEvent.change(nameInput, { target: { value: "Look 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create shot" }));

    await waitFor(() => expect(addDocCalls.length).toBe(1));
    expect(addDocCalls[0].path).toEqual(["clients", "unbound-merino", "shots"]);
    expect(addDocCalls[0].data.projectId).toBe("default-project");
    expect(addDocCalls[0].data.createdBy).toBe("test-user");
    expect(toastMock.success).toHaveBeenCalledWith('Shot "Look 1" created.');
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});
