import React from "react";
import { render } from "@testing-library/react-native";
import { OrgTabHeader } from "@/components/OrgTabHeader";
import { useOrgStore } from "@/lib/orgStore";
import { useNotificationsStore } from "@/lib/notificationsStore";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// orgStore imports lib/api -> lib/supabase, which requires env vars at import time.
jest.mock("@/lib/api", () => ({
  getOrganizationInfo: jest.fn(),
  getUnreadNotificationCount: jest.fn().mockResolvedValue({ count: 0 }),
}));

describe("OrgTabHeader", () => {
  beforeEach(() => {
    useOrgStore.setState({ orgName: null });
    useNotificationsStore.setState({ unreadCount: 0 });
  });

  it("renders the title", async () => {
    const { getByText } = await render(<OrgTabHeader title="Schedule" />);
    expect(getByText("Schedule")).toBeTruthy();
  });

  it("renders the org name when set", async () => {
    useOrgStore.setState({ orgName: "Acme Co" });
    const { getByText } = await render(<OrgTabHeader title="Schedule" />);
    expect(getByText("Acme Co")).toBeTruthy();
  });

  it("omits the org name row when unset", async () => {
    const { queryByText } = await render(<OrgTabHeader title="Schedule" />);
    expect(queryByText("Acme Co")).toBeNull();
  });

  it("shows an unread badge when there are unread notifications", async () => {
    useNotificationsStore.setState({ unreadCount: 3 });
    const { getByText } = await render(<OrgTabHeader title="Schedule" />);
    expect(getByText("3")).toBeTruthy();
  });

  it("omits the badge when there are no unread notifications", async () => {
    const { queryByText } = await render(<OrgTabHeader title="Schedule" />);
    expect(queryByText("0")).toBeNull();
  });
});
