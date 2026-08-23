import { useThemeStore } from "@/lib/themeStore";
import type { OrganizationTheme } from "@scheduler/types";

describe("useThemeStore", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: null });
  });

  it("defaults to no theme", () => {
    expect(useThemeStore.getState().theme).toBeNull();
  });

  it("setTheme stores the theme", () => {
    const theme = { primaryColor: "#123456" } as unknown as OrganizationTheme;
    useThemeStore.getState().setTheme(theme);
    expect(useThemeStore.getState().theme).toEqual(theme);
  });

  it("setTheme(null) clears the theme", () => {
    useThemeStore.getState().setTheme({ primaryColor: "#123456" } as unknown as OrganizationTheme);
    useThemeStore.getState().setTheme(null);
    expect(useThemeStore.getState().theme).toBeNull();
  });
});
