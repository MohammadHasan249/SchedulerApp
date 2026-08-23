import React from "react";
import { render } from "@testing-library/react-native";
import { OrgTabHeader } from "@/components/OrgTabHeader";
import { useOrgStore } from "@/lib/orgStore";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// orgStore imports lib/api -> lib/supabase, which requires env vars at import time.
jest.mock("@/lib/api", () => ({
  getOrganizationInfo: jest.fn(),
}));

describe("OrgTabHeader", () => {
  beforeEach(() => {
    useOrgStore.setState({ orgName: null });
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
});
