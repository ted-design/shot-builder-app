import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

globalThis.React = React;

// Helper to render with QueryClientProvider
const renderWithQueryClient = (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

const showConfirmMock = vi.fn(() => Promise.resolve(true));

const authState = {
  clientId: "unbound-merino",
  role: "producer",
  user: { uid: "tester" },
};

const snapshotData = new Map();
const writeBatchCalls = [];
const deleteImageMock = vi.fn(() => Promise.resolve());

const pathKey = (segments) => (Array.isArray(segments) ? segments.join("/") : "");

const setSnapshot = (segments, docs) => {
  snapshotData.set(
    pathKey(segments),
    docs.map((entry) => ({ id: entry.id, data: entry.data }))
  );
};

const getSnapshotForPath = (path) => {
  const docs = snapshotData.get(path) || [];
  const entries = docs.map((doc) => ({
    id: doc.id,
    data: () => ({ ...doc.data }),
  }));
  return {
    docs: entries,
    forEach: (callback) => entries.forEach((entry) => callback(entry)),
  };
};

const collapseArgs = (maybeDb, segments) => {
  if (segments.length) return segments;
  if (Array.isArray(maybeDb)) return maybeDb;
  if (maybeDb && Array.isArray(maybeDb.__path)) return maybeDb.__path;
  return [];
};

const collectionMock = vi.fn((maybeDb, ...segments) => ({ __path: collapseArgs(maybeDb, segments) }));
const docMock = vi.fn((maybeDb, ...segments) => ({ __path: collapseArgs(maybeDb, segments) }));
const queryMock = vi.fn((ref) => ({ __path: ref.__path, __ref: ref }));
const orderByMock = vi.fn((...args) => ({ __orderBy: args }));
const setDocMock = vi.fn(async () => {});
const updateDocMock = vi.fn(async () => {});
const deleteDocMock = vi.fn(async () => {});
const addDocMock = vi.fn(async () => ({ id: "new-doc", __path: [] }));

const onSnapshotMock = vi.fn((ref, onNext) => {
  const key = pathKey(ref.__path || []);
  onNext?.(getSnapshotForPath(key));
  return () => {};
});

const getDocsMock = vi.fn(async (ref) => getSnapshotForPath(pathKey(ref.__path || [])));

const writeBatchMock = vi.fn(() => {
  const operations = [];
  return {
    update: (ref, data) => operations.push({ type: "update", ref, data }),
    delete: (ref) => operations.push({ type: "delete", ref }),
    set: (ref, data, options) => operations.push({ type: "set", ref, data, options }),
    commit: vi.fn(async () => {
      writeBatchCalls.push(operations.slice());
    }),
  };
});

vi.mock("firebase/firestore", () => ({
  collection: collectionMock,
  doc: docMock,
  query: queryMock,
  orderBy: orderByMock,
  onSnapshot: onSnapshotMock,
  getDocs: getDocsMock,
  addDoc: addDocMock,
  updateDoc: updateDocMock,
  deleteDoc: deleteDocMock,
  setDoc: setDocMock,
  writeBatch: writeBatchMock,
}));

vi.mock("../../lib/firebase", () => ({
  db: {},
  uploadImageFile: vi.fn(async () => ({ path: "uploaded" })),
  deleteImageByPath: deleteImageMock,
}));

vi.mock("../../lib/toast", () => ({
  toast: toastMock,
  showConfirm: showConfirmMock,
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => authState,
}));

const appImageMock = vi.fn();

vi.mock("../../components/common/AppImage", () => ({
  __esModule: true,
  default: (props) => {
    appImageMock(props);
    return <div data-testid="app-image" />;
  },
}));

vi.mock("../../components/products/NewProductModal", () => ({
  default: () => null,
}));

vi.mock("../../components/products/EditProductModal", () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  snapshotData.clear();
  writeBatchCalls.length = 0;
  deleteImageMock.mockClear();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  toastMock.info.mockClear();
  toastMock.warning.mockClear();
  showConfirmMock.mockClear();
  showConfirmMock.mockReturnValue(Promise.resolve(true));
  appImageMock.mockClear();
  authState.role = "producer";
  authState.user = { uid: "tester" };
  window.localStorage.clear();
  window.localStorage.setItem("products:viewMode", "list");
});

describe("ProductsPage", () => {
  it("sorts products by the selected option", async () => {
    setSnapshot([
      "clients",
      "unbound-merino",
      "productFamilies",
    ], [
      {
        id: "fam-bravo",
        data: {
          styleName: "Bravo Coat",
          styleNumber: "200",
          status: "active",
          archived: false,
        },
      },
      {
        id: "fam-alpha",
        data: {
          styleName: "Alpha Jacket",
          styleNumber: "100",
          status: "active",
          archived: false,
        },
      },
    ]);

    vi.resetModules();
    const { default: ProductsPage } = await import("../ProductsPage.jsx");
    renderWithQueryClient(<ProductsPage />);

    const table = await screen.findByRole("table");
    const readOrder = () =>
      Array.from(table.querySelectorAll("tbody tr")).map((row) =>
        row.querySelector('[data-testid^="style-name-"]').textContent.trim()
      );

    await waitFor(() => {
      expect(readOrder()).toEqual(["Alpha Jacket", "Bravo Coat"]);
    });

    const sortSelect = screen.getByLabelText(/Sort/i);

    fireEvent.change(sortSelect, { target: { value: "styleNameDesc" } });
    await waitFor(() => {
      expect(readOrder()).toEqual(["Bravo Coat", "Alpha Jacket"]);
    });

    fireEvent.change(sortSelect, { target: { value: "styleNumberAsc" } });
    await waitFor(() => {
      expect(readOrder()).toEqual(["Alpha Jacket", "Bravo Coat"]);
    });

    fireEvent.change(sortSelect, { target: { value: "styleNumberDesc" } });
    await waitFor(() => {
      expect(readOrder()).toEqual(["Bravo Coat", "Alpha Jacket"]);
    });
  });

  it("shows batch actions for multi-select and archives selected products", async () => {
    setSnapshot([
      "clients",
      "unbound-merino",
      "productFamilies",
    ], [
      {
        id: "fam-alpha",
        data: {
          styleName: "Alpha Jacket",
          styleNumber: "100",
          status: "active",
          archived: false,
        },
      },
      {
        id: "fam-bravo",
        data: {
          styleName: "Bravo Coat",
          styleNumber: "200",
          status: "active",
          archived: false,
        },
      },
    ]);

    vi.resetModules();
    const { default: ProductsPage } = await import("../ProductsPage.jsx");
    renderWithQueryClient(<ProductsPage />);

    await screen.findByText("Alpha Jacket");

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Alpha Jacket" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Bravo Coat" }));

    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Archive$/ }));

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith("Archived 2 product families.");
    });

    expect(writeBatchMock).toHaveBeenCalledTimes(1);
    expect(writeBatchCalls).toHaveLength(1);
    expect(writeBatchCalls[0]).toHaveLength(2);
    writeBatchCalls[0].forEach((operation) => {
      expect(operation.type).toBe("update");
      expect(operation.data.archived).toBe(true);
    });

    await waitFor(() => {
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });
  });

  it("deletes selected products using batched writes", async () => {
    authState.role = "admin";
    setSnapshot([
      "clients",
      "unbound-merino",
      "productFamilies",
    ], [
      {
        id: "fam-alpha",
        data: {
          styleName: "Alpha Jacket",
          styleNumber: "100",
          status: "active",
          archived: false,
          headerImagePath: "alpha-header.jpg",
          thumbnailImagePath: "alpha-thumb.jpg",
        },
      },
      {
        id: "fam-bravo",
        data: {
          styleName: "Bravo Coat",
          styleNumber: "200",
          status: "active",
          archived: false,
          headerImagePath: "bravo-header.jpg",
          thumbnailImagePath: "bravo-thumb.jpg",
        },
      },
    ]);

    vi.resetModules();
    const { default: ProductsPage } = await import("../ProductsPage.jsx");
    renderWithQueryClient(<ProductsPage />);

    await screen.findByText("Alpha Jacket");

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Alpha Jacket" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Bravo Coat" }));

    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith("Deleted 2 product families.");
    });

    // Soft delete uses update operations, not delete
    expect(writeBatchCalls).toHaveLength(1);
    expect(writeBatchCalls[0]).toHaveLength(2); // 2 products
    writeBatchCalls[0].forEach((operation) => {
      expect(operation.type).toBe("update");
      expect(operation.data.deleted).toBe(true);
      expect(typeof operation.data.deletedAt).toBe("number");
      expect(Array.isArray(operation.ref.__path)).toBe(true);
    });

    // Images are preserved with soft delete, not deleted
    expect(deleteImageMock).not.toHaveBeenCalled();
  });
});
