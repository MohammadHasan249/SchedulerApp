import React from "react";
import { Alert } from "react-native";
import { addDays, format, startOfDay } from "date-fns";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import ReportsScreen from "../reports";
import { getClockEvents, getBranches } from "@/lib/api";
import type { ClockEventRow, Branch } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  getClockEvents: jest.fn(),
  getBranches: jest.fn(),
}));

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
}));

function makeRow(overrides: Partial<ClockEventRow> = {}): ClockEventRow {
  return {
    event: {
      id: "evt-1",
      employeeId: "emp-1",
      branchId: "branch-1",
      type: "clock_in",
      timestamp: "2026-01-01T09:00:00.000Z",
    },
    employee: { id: "emp-1", name: "Jane Doe", email: "jane@example.com" },
    ...overrides,
  } as ClockEventRow;
}

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return { id: "branch-1", slug: "main", name: "Main Branch", ...overrides } as Branch;
}

describe("ReportsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (getBranches as jest.Mock).mockResolvedValue([]);
  });

  it("shows the empty state for a day with no events", async () => {
    (getClockEvents as jest.Mock).mockResolvedValue([]);

    const { findByText } = await render(<ReportsScreen />);

    expect(await findByText("No clock-in/out events for this day.")).toBeTruthy();
  });

  it("renders clock-in and clock-out rows", async () => {
    (getClockEvents as jest.Mock).mockResolvedValue([
      makeRow({
        event: { id: "e1", employeeId: "emp-1", branchId: "b1", type: "clock_in", timestamp: "2026-01-01T09:00:00.000Z" },
      }),
      makeRow({
        event: { id: "e2", employeeId: "emp-1", branchId: "b1", type: "clock_out", timestamp: "2026-01-01T17:00:00.000Z" },
      }),
    ]);

    const { findAllByText, findByText } = await render(<ReportsScreen />);

    expect((await findAllByText("Jane Doe")).length).toBe(2);
    expect(await findByText("Clocked in")).toBeTruthy();
    expect(await findByText("Clocked out")).toBeTruthy();
  });

  it("shows an alert when loading fails", async () => {
    (getClockEvents as jest.Mock).mockRejectedValue(new Error("network down"));

    await render(<ReportsScreen />);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Couldn't load attendance", "network down")
    );
  });

  it("does not show branch filter chips when there is only one branch", async () => {
    (getClockEvents as jest.Mock).mockResolvedValue([]);
    (getBranches as jest.Mock).mockResolvedValue([makeBranch()]);

    const { findByText, queryByText } = await render(<ReportsScreen />);
    await findByText("No clock-in/out events for this day.");

    expect(queryByText("All branches")).toBeNull();
  });

  it("filters by branch when a chip is pressed", async () => {
    (getClockEvents as jest.Mock).mockResolvedValue([]);
    (getBranches as jest.Mock).mockResolvedValue([
      makeBranch({ id: "b1", name: "Main" }),
      makeBranch({ id: "b2", name: "Uptown" }),
    ]);

    const { findByText, getByText } = await render(<ReportsScreen />);
    await findByText("Main");

    await fireEvent.press(getByText("Uptown"));

    await waitFor(() => {
      const lastCall = (getClockEvents as jest.Mock).mock.calls.at(-1)?.[0];
      expect(lastCall.branchId).toBe("b2");
    });
  });

  it("reloads for the previous day when the left chevron is pressed", async () => {
    (getClockEvents as jest.Mock).mockResolvedValue([]);

    const { findByText, getByLabelText } = await render(<ReportsScreen />);
    const todayLabel = format(new Date(), "EEEE, MMM d, yyyy");
    await findByText(todayLabel);

    await fireEvent.press(getByLabelText("Previous day"));

    const yesterdayLabel = format(addDays(new Date(), -1), "EEEE, MMM d, yyyy");
    expect(await findByText(yesterdayLabel)).toBeTruthy();

    await waitFor(() => {
      const lastCall = (getClockEvents as jest.Mock).mock.calls.at(-1)?.[0];
      expect(lastCall.from).toBe(startOfDay(addDays(new Date(), -1)).toISOString());
    });
    expect(getClockEvents).toHaveBeenCalledTimes(2);
  });
});
