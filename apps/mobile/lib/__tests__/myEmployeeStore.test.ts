import { useMyEmployeeStore } from "@/lib/myEmployeeStore";
import { getEmployees } from "@/lib/api";
import type { Employee } from "@scheduler/types";

jest.mock("@/lib/api", () => ({
  getEmployees: jest.fn(),
}));

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp-1",
    authUserId: "auth-1",
    ...overrides,
  } as Employee;
}

describe("useMyEmployeeStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMyEmployeeStore.getState().reset();
  });

  it("defaults to no employee and not loaded", () => {
    const { employee, loaded } = useMyEmployeeStore.getState();
    expect(employee).toBeNull();
    expect(loaded).toBe(false);
  });

  it("fetches all employees and picks the one matching authUserId", async () => {
    const mine = makeEmployee({ id: "emp-1", authUserId: "auth-1" });
    const other = makeEmployee({ id: "emp-2", authUserId: "auth-2" });
    (getEmployees as jest.Mock).mockResolvedValue([other, mine]);

    const result = await useMyEmployeeStore.getState().fetchMyEmployee("auth-1");

    expect(result).toEqual(mine);
    expect(useMyEmployeeStore.getState().employee).toEqual(mine);
    expect(useMyEmployeeStore.getState().loaded).toBe(true);
  });

  it("returns null and marks loaded when no employee matches", async () => {
    (getEmployees as jest.Mock).mockResolvedValue([makeEmployee({ authUserId: "someone-else" })]);

    const result = await useMyEmployeeStore.getState().fetchMyEmployee("auth-1");

    expect(result).toBeNull();
    expect(useMyEmployeeStore.getState().loaded).toBe(true);
  });

  it("marks loaded (without throwing) when the API call fails", async () => {
    (getEmployees as jest.Mock).mockRejectedValue(new Error("network error"));

    const result = await useMyEmployeeStore.getState().fetchMyEmployee("auth-1");

    expect(result).toBeNull();
    expect(useMyEmployeeStore.getState().loaded).toBe(true);
  });

  it("returns the cached employee without calling the API again once cached", async () => {
    const mine = makeEmployee({ id: "emp-1", authUserId: "auth-1" });
    (getEmployees as jest.Mock).mockResolvedValue([mine]);

    await useMyEmployeeStore.getState().fetchMyEmployee("auth-1");
    (getEmployees as jest.Mock).mockClear();

    const result = await useMyEmployeeStore.getState().fetchMyEmployee("auth-1");

    expect(result).toEqual(mine);
    expect(getEmployees).not.toHaveBeenCalled();
  });

  it("dedupes concurrent calls into a single API request", async () => {
    const mine = makeEmployee({ id: "emp-1", authUserId: "auth-1" });
    let resolveFetch: (value: Employee[]) => void;
    (getEmployees as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const call1 = useMyEmployeeStore.getState().fetchMyEmployee("auth-1");
    const call2 = useMyEmployeeStore.getState().fetchMyEmployee("auth-1");

    resolveFetch!([mine]);
    const [result1, result2] = await Promise.all([call1, call2]);

    expect(getEmployees).toHaveBeenCalledTimes(1);
    expect(result1).toEqual(mine);
    expect(result2).toEqual(mine);
  });

  it("reset clears the cached employee and loaded flag", async () => {
    const mine = makeEmployee({ id: "emp-1", authUserId: "auth-1" });
    (getEmployees as jest.Mock).mockResolvedValue([mine]);
    await useMyEmployeeStore.getState().fetchMyEmployee("auth-1");

    useMyEmployeeStore.getState().reset();

    expect(useMyEmployeeStore.getState().employee).toBeNull();
    expect(useMyEmployeeStore.getState().loaded).toBe(false);
  });
});
