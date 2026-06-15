import { describe, it, expect } from "vitest";
import { resolvePermissions } from "./permissions";

describe("resolvePermissions", () => {
  it("grants org_admin every permission regardless of profile", () => {
    const perms = resolvePermissions("org_admin", []);
    expect(perms.has("salaries:view")).toBe(true);
    expect(perms.has("salaries:edit")).toBe(true);
  });

  it("grants non-admins exactly what their profile lists", () => {
    const perms = resolvePermissions("branch_manager", ["salaries:view"]);
    expect(perms.has("salaries:view")).toBe(true);
    expect(perms.has("salaries:edit")).toBe(false);
  });

  it("gives non-admins nothing when they have no profile", () => {
    expect(resolvePermissions("employee", null).size).toBe(0);
    expect(resolvePermissions("branch_manager", undefined).size).toBe(0);
    expect(resolvePermissions("employee", []).size).toBe(0);
  });

  it("ignores unknown/stale permission keys", () => {
    const perms = resolvePermissions("branch_manager", ["salaries:view", "bogus:key"]);
    expect(perms.has("salaries:view")).toBe(true);
    expect([...perms]).toEqual(["salaries:view"]);
  });
});
