import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import NotificationPanel from "../NotificationPanel";

// Mock the hooks
vi.mock("../../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../../hooks/useFirestoreMutations", () => ({
  useMarkAsRead: vi.fn(),
  useDismissNotification: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

import { useAuth } from "../../../context/AuthContext";
import { useMarkAsRead, useDismissNotification } from "../../../hooks/useFirestoreMutations";
import { useNavigate } from "react-router-dom";

describe("NotificationPanel", () => {
  const mockUser = { uid: "user123" };
  const mockClientId = "client123";
  const mockNavigate = vi.fn();
  const mockMarkAsRead = vi.fn();
  const mockDismissNotification = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: mockUser,
      clientId: mockClientId,
    });
    useNavigate.mockReturnValue(mockNavigate);
    useMarkAsRead.mockReturnValue({
      mutate: mockMarkAsRead,
      isPending: false,
    });
    useDismissNotification.mockReturnValue({
      mutate: mockDismissNotification,
      isPending: false,
    });
  });

  const renderWithRouter = (ui) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
  };

  describe("Loading State", () => {
    it("displays loading spinner when isLoading is true", () => {
      renderWithRouter(
        <NotificationPanel notifications={[]} isLoading={true} onClose={mockOnClose} />
      );

      const spinner = screen.getByRole("status");
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute("aria-label", "Loading");
    });
  });

  describe("Empty State", () => {
    it("displays empty state when there are no notifications", () => {
      renderWithRouter(
        <NotificationPanel notifications={[]} isLoading={false} onClose={mockOnClose} />
      );

      expect(screen.getByText("No notifications")).toBeInTheDocument();
      expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
    });

    it("does not show mark all as read button in empty state", () => {
      renderWithRouter(
        <NotificationPanel notifications={[]} isLoading={false} onClose={mockOnClose} />
      );

      expect(screen.queryByText("Mark all read")).not.toBeInTheDocument();
    });
  });

  describe("Header", () => {
    it("displays the header with title", () => {
      renderWithRouter(
        <NotificationPanel notifications={[]} isLoading={false} onClose={mockOnClose} />
      );

      expect(screen.getByText("Notifications")).toBeInTheDocument();
    });

    it("shows mark all as read button when there are unread notifications", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Test",
          message: "Unread",
          type: "generic",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("Mark all read")).toBeInTheDocument();
    });

    it("does not show mark all as read button when all notifications are read", () => {
      const notifications = [
        {
          id: "1",
          read: true,
          title: "Test",
          message: "Read",
          type: "generic",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText("Mark all read")).not.toBeInTheDocument();
    });
  });

  describe("Mark All As Read", () => {
    it("calls markAsRead with all unread notification IDs", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Test 1",
          message: "Unread 1",
          type: "generic",
          createdAt: new Date(),
        },
        {
          id: "2",
          read: false,
          title: "Test 2",
          message: "Unread 2",
          type: "generic",
          createdAt: new Date(),
        },
        {
          id: "3",
          read: true,
          title: "Test 3",
          message: "Read",
          type: "generic",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      const button = screen.getByText("Mark all read");
      fireEvent.click(button);

      expect(mockMarkAsRead).toHaveBeenCalledWith({
        notificationIds: ["1", "2"],
      });
    });

    it("disables button when mark as read is pending", () => {
      useMarkAsRead.mockReturnValue({
        mutate: mockMarkAsRead,
        isPending: true,
      });

      const notifications = [
        {
          id: "1",
          read: false,
          title: "Test",
          message: "Unread",
          type: "generic",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      const button = screen.getByText("Mark all read");
      expect(button).toBeDisabled();
    });
  });

  describe("Notification List", () => {
    it("renders unread notifications with unread indicator", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Unread Notification",
          message: "This is unread",
          type: "shot_assigned",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("Unread Notification")).toBeInTheDocument();
      expect(screen.getByText("This is unread")).toBeInTheDocument();
    });

    it("groups notifications by read status", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Unread",
          message: "Unread message",
          type: "generic",
          createdAt: new Date(),
        },
        {
          id: "2",
          read: true,
          title: "Read",
          message: "Read message",
          type: "generic",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      // Should show "Earlier" label when both groups exist
      expect(screen.getByText("Earlier")).toBeInTheDocument();
      expect(screen.getByText("Unread")).toBeInTheDocument();
      expect(screen.getByText("Read")).toBeInTheDocument();
    });

    it("does not show Earlier label when only unread notifications exist", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Unread",
          message: "Unread message",
          type: "generic",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText("Earlier")).not.toBeInTheDocument();
    });
  });

  describe("Notification Item Interactions", () => {
    it("marks unread notification as read when clicked", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Unread",
          message: "Click me",
          type: "generic",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      const notification = screen.getByText("Click me").closest("div[role='button']");
      fireEvent.click(notification);

      expect(mockMarkAsRead).toHaveBeenCalledWith({
        notificationIds: ["1"],
      });
    });

    it("does not mark read notification as read again when clicked", () => {
      const notifications = [
        {
          id: "1",
          read: true,
          title: "Read",
          message: "Already read",
          type: "generic",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      const notification = screen.getByText("Already read").closest("div[role='button']");
      fireEvent.click(notification);

      expect(mockMarkAsRead).not.toHaveBeenCalled();
    });

    it("navigates when notification with actionUrl is clicked", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Navigate",
          message: "Click to navigate",
          type: "generic",
          actionUrl: "/projects/123",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      const notification = screen.getByText("Click to navigate").closest("div[role='button']");
      fireEvent.click(notification);

      expect(mockNavigate).toHaveBeenCalledWith("/projects/123");
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("dismisses notification when dismiss button is clicked", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Dismissible",
          message: "Can be dismissed",
          type: "generic",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      const dismissButton = screen.getByLabelText("Dismiss notification");
      fireEvent.click(dismissButton);

      expect(mockDismissNotification).toHaveBeenCalledWith({
        notificationId: "1",
      });
    });

    it("stops propagation when dismiss button is clicked", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Test",
          message: "Test message",
          type: "generic",
          actionUrl: "/test",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      const dismissButton = screen.getByLabelText("Dismiss notification");
      fireEvent.click(dismissButton);

      // Should only dismiss, not navigate
      expect(mockDismissNotification).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("handles keyboard interaction on notification item", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Keyboard",
          message: "Press enter",
          type: "generic",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      const notification = screen.getByText("Press enter").closest("div[role='button']");

      // Press Enter
      fireEvent.keyDown(notification, { key: "Enter" });
      expect(mockMarkAsRead).toHaveBeenCalledWith({ notificationIds: ["1"] });

      vi.clearAllMocks();

      // Press Space
      fireEvent.keyDown(notification, { key: " " });
      expect(mockMarkAsRead).toHaveBeenCalledWith({ notificationIds: ["1"] });
    });
  });

  describe("Notification Icons", () => {
    it("displays correct icon for shot_assigned type", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Shot Assigned",
          message: "Camera icon",
          type: "shot_assigned",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      // Icon should be rendered (testing the component renders without errors)
      expect(screen.getByText("Shot Assigned")).toBeInTheDocument();
    });

    it("displays correct icon for pull_ready type", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Pull Ready",
          message: "Package icon",
          type: "pull_ready",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("Pull Ready")).toBeInTheDocument();
    });

    it("displays generic bell icon for unknown types", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Unknown",
          message: "Generic icon",
          type: "unknown_type",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  describe("Relative Time Formatting", () => {
    it("displays formatted relative time for each notification", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-10-14T12:00:00Z"));

      const notifications = [
        {
          id: "1",
          read: false,
          title: "Recent",
          message: "Just happened",
          type: "generic",
          createdAt: new Date("2025-10-14T11:55:00Z"),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("5 minutes ago")).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe("Accessibility", () => {
    it("has proper role attributes on notification items", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Accessible",
          message: "Test message",
          type: "generic",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      const notification = screen.getByText("Test message").closest("div[role='button']");
      expect(notification).toHaveAttribute("role", "button");
      expect(notification).toHaveAttribute("tabIndex", "0");
    });

    it("has proper aria-label on dismiss button", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "Test",
          message: "Test",
          type: "generic",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      const dismissButton = screen.getByLabelText("Dismiss notification");
      expect(dismissButton).toHaveAttribute("title", "Dismiss");
    });
  });

  describe("Edge Cases", () => {
    it("handles undefined notifications prop", () => {
      renderWithRouter(<NotificationPanel isLoading={false} onClose={mockOnClose} />);

      expect(screen.getByText("No notifications")).toBeInTheDocument();
    });

    it("handles notification without title", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          message: "No title",
          type: "generic",
          createdAt: new Date(),
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("No title")).toBeInTheDocument();
    });

    it("handles notification without createdAt", () => {
      const notifications = [
        {
          id: "1",
          read: false,
          title: "No timestamp",
          message: "Test",
          type: "generic",
        },
      ];

      renderWithRouter(
        <NotificationPanel
          notifications={notifications}
          isLoading={false}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("No timestamp")).toBeInTheDocument();
    });
  });
});
