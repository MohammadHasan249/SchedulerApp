import { useOrgStore } from "@/lib/orgStore";
import { getOrganizationInfo } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  getOrganizationInfo: jest.fn(),
}));

describe("useOrgStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOrgStore.setState({ orgName: null });
  });

  it("defaults to no org name", () => {
    expect(useOrgStore.getState().orgName).toBeNull();
  });

  it("fetchOrgInfo stores the org name from the API", async () => {
    (getOrganizationInfo as jest.Mock).mockResolvedValue({ name: "Acme Co" });

    await useOrgStore.getState().fetchOrgInfo();

    expect(useOrgStore.getState().orgName).toBe("Acme Co");
  });

  it("fetchOrgInfo silently no-ops on API failure", async () => {
    (getOrganizationInfo as jest.Mock).mockRejectedValue(new Error("network error"));

    await expect(useOrgStore.getState().fetchOrgInfo()).resolves.toBeUndefined();
    expect(useOrgStore.getState().orgName).toBeNull();
  });
});
