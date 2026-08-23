import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useRole, useIsAdmin, useBranchId, type AppRole } from "@/lib/useRole";
import { useAuthStore } from "@/lib/authStore";
import type { Session } from "@supabase/supabase-js";

// @testing-library/react-native's renderHook returns an unusable result under
// this project's React 19 / react-test-renderer combo, so hooks are exercised
// directly through a throwaway host component instead.
function renderHookValue<T>(hook: () => T): T {
  let value!: T;
  function Probe() {
    value = hook();
    return null;
  }
  let renderer!: ReturnType<typeof TestRenderer.create>;
  act(() => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });
  act(() => {
    renderer.unmount();
  });
  return value;
}

function sessionWith(app_metadata: Record<string, unknown>): Session {
  return { user: { app_metadata } } as unknown as Session;
}

describe("useRole", () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, employeeName: null });
  });

  it("defaults to 'employee' when there is no session", () => {
    expect(renderHookValue(useRole)).toBe("employee");
  });

  it("defaults to 'employee' when app_metadata has no role", () => {
    useAuthStore.setState({ session: sessionWith({}) });
    expect(renderHookValue(useRole)).toBe("employee");
  });

  it("reads the role from session app_metadata", () => {
    useAuthStore.setState({ session: sessionWith({ role: "org_admin" }) });
    expect(renderHookValue(useRole)).toBe("org_admin");
  });
});

describe("useIsAdmin", () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, employeeName: null });
  });

  it.each<AppRole>(["org_admin", "branch_manager"])("is true for role %s", (role) => {
    useAuthStore.setState({ session: sessionWith({ role }) });
    expect(renderHookValue(useIsAdmin)).toBe(true);
  });

  it("is false for employee", () => {
    useAuthStore.setState({ session: sessionWith({ role: "employee" }) });
    expect(renderHookValue(useIsAdmin)).toBe(false);
  });

  it("is false when there is no session", () => {
    expect(renderHookValue(useIsAdmin)).toBe(false);
  });
});

describe("useBranchId", () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, employeeName: null });
  });

  it("returns null when there is no session", () => {
    expect(renderHookValue(useBranchId)).toBeNull();
  });

  it("reads branch_id from session app_metadata", () => {
    useAuthStore.setState({ session: sessionWith({ branch_id: "branch-1" }) });
    expect(renderHookValue(useBranchId)).toBe("branch-1");
  });
});
