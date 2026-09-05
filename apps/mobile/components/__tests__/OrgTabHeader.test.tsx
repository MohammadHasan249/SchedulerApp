import React from "react";
import { render } from "@/test-utils";
import { OrgTabHeader } from "@/components/OrgTabHeader";
import { getOrganizationInfo, getUnreadNotificationCount } from "@/lib/api";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/api", () => ({
  getOrganizationInfo: jest.fn(),
  getUnreadNotificationCount: jest.fn(),
}));

describe("OrgTabHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getOrganizationInfo as jest.Mock).mockResolvedValue({ name: null, slug: null });
    (getUnreadNotificationCount as jest.Mock).mockResolvedValue({ count: 0 });
  });

  it("renders the title", async () => {
    const { getByText } = await render(<OrgTabHeader title="Schedule" />);
    expect(getByText("Schedule")).toBeTruthy();
  });

  it("renders the org name when set", async () => {
    (getOrganizationInfo as jest.Mock).mockResolvedValue({ name: "Acme Co", slug: "acme" });
    const { findByText } = await render(<OrgTabHeader title="Schedule" />);
    expect(await findByText("Acme Co")).toBeTruthy();
  });

  it("omits the org name row when unset", async () => {
    const { queryByText } = await render(<OrgTabHeader title="Schedule" />);
    expect(queryByText("Acme Co")).toBeNull();
  });

  it("shows an unread badge when there are unread notifications", async () => {
    (getUnreadNotificationCount as jest.Mock).mockResolvedValue({ count: 3 });
    const { findByText } = await render(<OrgTabHeader title="Schedule" />);
    expect(await findByText("3")).toBeTruthy();
  });

  it("omits the badge when there are no unread notifications", async () => {
    const { queryByText } = await render(<OrgTabHeader title="Schedule" />);
    expect(queryByText("0")).toBeNull();
  });
});
