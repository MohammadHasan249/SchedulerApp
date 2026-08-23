import * as SecureStore from "expo-secure-store";
import { useKioskStore } from "@/lib/kioskStore";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe("useKioskStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    useKioskStore.setState({ isLocked: false, branchSlug: null });
  });

  it("defaults to unlocked with no branch slug", () => {
    const { isLocked, branchSlug } = useKioskStore.getState();
    expect(isLocked).toBe(false);
    expect(branchSlug).toBeNull();
  });

  it("setLocked updates state and persists to SecureStore", () => {
    useKioskStore.getState().setLocked(true);
    expect(useKioskStore.getState().isLocked).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("kiosk_locked", "1");
  });

  it("setLocked(false) persists '0'", () => {
    useKioskStore.getState().setLocked(false);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("kiosk_locked", "0");
  });

  it("setBranchSlug persists and updates state", async () => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    await useKioskStore.getState().setBranchSlug("main-branch");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("kiosk_branch_slug", "main-branch");
    expect(useKioskStore.getState().branchSlug).toBe("main-branch");
  });

  it("clearBranchSlug deletes from SecureStore and clears state", async () => {
    useKioskStore.setState({ branchSlug: "main-branch" });
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    await useKioskStore.getState().clearBranchSlug();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("kiosk_branch_slug");
    expect(useKioskStore.getState().branchSlug).toBeNull();
  });

  it("hydrate reads persisted slug and locked flag into state", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === "kiosk_branch_slug") return Promise.resolve("main-branch");
      if (key === "kiosk_locked") return Promise.resolve("1");
      return Promise.resolve(null);
    });

    await useKioskStore.getState().hydrate();

    expect(useKioskStore.getState().branchSlug).toBe("main-branch");
    expect(useKioskStore.getState().isLocked).toBe(true);
  });

  it("hydrate defaults to unlocked/null when nothing is persisted", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    await useKioskStore.getState().hydrate();

    expect(useKioskStore.getState().branchSlug).toBeNull();
    expect(useKioskStore.getState().isLocked).toBe(false);
  });
});
