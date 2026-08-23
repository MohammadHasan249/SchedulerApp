import { useAuthStore } from "@/lib/authStore";
import type { Session } from "@supabase/supabase-js";

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, employeeName: null });
  });

  it("defaults to no session and no employee name", () => {
    const { session, employeeName } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(employeeName).toBeNull();
  });

  it("setSession stores the session", () => {
    const session = { user: { id: "u1" } } as unknown as Session;
    useAuthStore.getState().setSession(session);
    expect(useAuthStore.getState().session).toBe(session);
  });

  it("setSession(null) clears the session", () => {
    useAuthStore.getState().setSession({ user: { id: "u1" } } as unknown as Session);
    useAuthStore.getState().setSession(null);
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("setEmployeeName stores the name", () => {
    useAuthStore.getState().setEmployeeName("Jane Doe");
    expect(useAuthStore.getState().employeeName).toBe("Jane Doe");
  });
});
