import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import NotificationBell from "../NotificationBell";

// Mock the hooks and components
vi.mock("../../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../../hooks/useFirestoreQuery", () => ({
  useNotifications: vi.fn(),
}));

vi.mock("../NotificationPanel", () => ({
  default: ({ notifications, isLoading, onClose }) => (
    <div data-testid="notification-panel">
      Panel open with {notifications.length} notifications
      <button onClick={onClose}>Close Panel</button>
    </div>
  ),
}));

import { useAuth } from "../../../context/AuthContext";
import { useNotifications } from "../../../hooks/useFirestoreQuery";

describe("NotificationBell", () => {
  const mockUser = { uid: "user123" };
  const mockClientId = "client123";

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: mockUser,
      clientId: mockClientId,
    });
    useNotifications.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it("renders the bell button", () => {
    render(<NotificationBell />);

    const button = screen.getByRole("button", { name: /notifications/i });
    expect(button).toBeInTheDocument();
  });

  it("does not show badge when there are no unread notifications", () => {
    useNotifications.mockReturnValue({
      data: [
        { id: "1", read: true, message: "Read notification" },
        { id: "2", read: true, message: "Another read notification" },
      ],
      isLoading: false,
    });

    render(<NotificationBell />);

    const badge = screen.queryByText(/\d+/);
    expect(badge).not.toBeInTheDocument();
  });

  it("shows unread count badge when there are unread notifications", () => {
    useNotifications.mockReturnValue({
      data: [
        { id: "1", read: false, message: "Unread 1" },
        { id: "2", read: false, message: "Unread 2" },
        { id: "3", read: true, message: "Read" },
      ],
      isLoading: false,
    });

    render(<NotificationBell />);

    const badge = screen.getByText("2");
    expect(badge).toBeInTheDocument();
  });

  it('shows "9+" when there are more than 9 unread notifications', () => {
    const notifications = Array.from({ length: 15 }, (_, i) => ({
      id: `${i}`,
      read: false,
      message: `Notification ${i}`,
    }));

    useNotifications.mockReturnValue({
      data: notifications,
      isLoading: false,
    });

    render(<NotificationBell />);

    const badge = screen.getByText("9+");
    expect(badge).toBeInTheDocument();
  });

  it("opens the notification panel when clicked", () => {
    render(<NotificationBell />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    const panel = screen.getByTestId("notification-panel");
    expect(panel).toBeInTheDocument();
  });

  it("closes the panel when clicked again", () => {
    render(<NotificationBell />);

    const button = screen.getByRole("button", { name: /notifications/i });

    // Open
    fireEvent.click(button);
    expect(screen.getByTestId("notification-panel")).toBeInTheDocument();

    // Close
    fireEvent.click(button);
    expect(screen.queryByTestId("notification-panel")).not.toBeInTheDocument();
  });

  it("closes panel when clicking outside", () => {
    render(
      <div>
        <NotificationBell />
        <div data-testid="outside">Outside</div>
      </div>
    );

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    expect(screen.getByTestId("notification-panel")).toBeInTheDocument();

    // Click outside
    const outside = screen.getByTestId("outside");
    fireEvent.mouseDown(outside);

    expect(screen.queryByTestId("notification-panel")).not.toBeInTheDocument();
  });

  it("closes panel when pressing Escape key", () => {
    render(<NotificationBell />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    expect(screen.getByTestId("notification-panel")).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByTestId("notification-panel")).not.toBeInTheDocument();
  });

  it("does not close panel when pressing other keys", () => {
    render(<NotificationBell />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    expect(screen.getByTestId("notification-panel")).toBeInTheDocument();

    // Press other keys
    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "Tab" });

    expect(screen.getByTestId("notification-panel")).toBeInTheDocument();
  });

  it("passes notifications to the panel", () => {
    const notifications = [
      { id: "1", read: false, message: "Test 1" },
      { id: "2", read: true, message: "Test 2" },
    ];

    useNotifications.mockReturnValue({
      data: notifications,
      isLoading: false,
    });

    render(<NotificationBell />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    expect(screen.getByText(/Panel open with 2 notifications/)).toBeInTheDocument();
  });

  it("has proper aria attributes", () => {
    useNotifications.mockReturnValue({
      data: [
        { id: "1", read: false, message: "Unread" },
        { id: "2", read: false, message: "Unread 2" },
      ],
      isLoading: false,
    });

    render(<NotificationBell />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Notifications (2 unread)");
    expect(button).toHaveAttribute("aria-haspopup", "true");
    expect(button).toHaveAttribute("aria-expanded", "false");

    // Open panel
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("has proper title attribute for tooltip", () => {
    render(<NotificationBell />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title", "Notifications");
  });

  it("calls useNotifications with correct parameters", () => {
    render(<NotificationBell />);

    expect(useNotifications).toHaveBeenCalledWith(mockClientId, mockUser.uid, {
      enabled: true,
    });
  });

  it("disables query when user is not authenticated", () => {
    useAuth.mockReturnValue({
      user: null,
      clientId: mockClientId,
    });

    render(<NotificationBell />);

    expect(useNotifications).toHaveBeenCalledWith(mockClientId, undefined, {
      enabled: false,
    });
  });

  it("disables query when clientId is not available", () => {
    useAuth.mockReturnValue({
      user: mockUser,
      clientId: null,
    });

    render(<NotificationBell />);

    expect(useNotifications).toHaveBeenCalledWith(null, mockUser.uid, {
      enabled: false,
    });
  });

  it("handles loading state", () => {
    useNotifications.mockReturnValue({
      data: [],
      isLoading: true,
    });

    render(<NotificationBell />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    // Panel should still render and handle loading
    const panel = screen.getByTestId("notification-panel");
    expect(panel).toBeInTheDocument();
  });

  it("cleans up event listeners when closed", () => {
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = render(<NotificationBell />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    // Close by clicking outside
    fireEvent.mouseDown(document.body);

    // Should have cleaned up
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "mousedown",
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    unmount();
    removeEventListenerSpy.mockRestore();
  });
});
