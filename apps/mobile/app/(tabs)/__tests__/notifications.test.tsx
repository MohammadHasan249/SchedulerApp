import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import NotificationsScreen from "../notifications";
import { getNotifications, markNotificationRead, getUnreadNotificationCount } from "@/lib/api";
import type { Notification } from "@scheduler/types";

jest.mock("@/lib/api", () => ({
  getNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  getUnreadNotificationCount: jest.fn(),
}));

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    employeeId: "emp-1",
    organizationId: "org-1",
    message: "Your shift was updated",
    isRead: false,
    createdAt: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("NotificationsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (getUnreadNotificationCount as jest.Mock).mockResolvedValue({ count: 0 });
  });

  it("shows the empty state when there are no notifications", async () => {
    (getNotifications as jest.Mock).mockResolvedValue([]);

    const { findByText } = await render(<NotificationsScreen />);

    expect(await findByText("No notifications")).toBeTruthy();
  });

  it("renders notification messages and timestamps", async () => {
    (getNotifications as jest.Mock).mockResolvedValue([makeNotification()]);

    const { findByText } = await render(<NotificationsScreen />);

    expect(await findByText("Your shift was updated")).toBeTruthy();
  });

  it("shows an alert when loading fails", async () => {
    (getNotifications as jest.Mock).mockRejectedValue(new Error("network down"));

    await render(<NotificationsScreen />);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Couldn't load notifications", "network down")
    );
  });

  it("marks an unread notification as read when pressed", async () => {
    (getNotifications as jest.Mock).mockResolvedValue([makeNotification({ isRead: false })]);
    (markNotificationRead as jest.Mock).mockResolvedValue(undefined);

    const { findByText } = await render(<NotificationsScreen />);
    await fireEvent.press(await findByText("Your shift was updated"));

    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith("n1"));
  });

  it("does not call the API again when pressing an already-read notification", async () => {
    (getNotifications as jest.Mock).mockResolvedValue([makeNotification({ isRead: true })]);

    const { findByText } = await render(<NotificationsScreen />);
    await fireEvent.press(await findByText("Your shift was updated"));

    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it("fetches only the first page and loads more on demand", async () => {
    const firstPage = Array.from({ length: 5 }, (_, i) =>
      makeNotification({ id: `n${i}`, message: `Message ${i}` })
    );
    const secondPage = [makeNotification({ id: "n5", message: "Message 5" })];
    (getNotifications as jest.Mock)
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);

    const { findByText } = await render(<NotificationsScreen />);

    expect(getNotifications).toHaveBeenNthCalledWith(1, { limit: 5, offset: 0 });
    const seeMore = await findByText("See more");
    await fireEvent.press(seeMore);

    await waitFor(() =>
      expect(getNotifications).toHaveBeenNthCalledWith(2, { limit: 5, offset: 5 })
    );
    expect(await findByText("Message 5")).toBeTruthy();
  });
});
