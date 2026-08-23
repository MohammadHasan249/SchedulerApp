import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { EmployeeCompensation } from "@/components/EmployeeCompensation";
import { getPayRates, createPayRate } from "@/lib/api";
import type { PayRate } from "@scheduler/types";

jest.mock("@/lib/api", () => ({
  getPayRates: jest.fn(),
  createPayRate: jest.fn(),
}));

function makeRate(overrides: Partial<PayRate> = {}): PayRate {
  return {
    id: "rate-1",
    employeeId: "emp-1",
    payType: "hourly",
    amountCents: 2150,
    currency: "CAD",
    effectiveDate: "2026-01-01",
    note: null,
    ...overrides,
  } as PayRate;
}

describe("EmployeeCompensation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows 'Not set' when there are no rates", async () => {
    (getPayRates as jest.Mock).mockResolvedValue([]);

    const { findByText } = await render(<EmployeeCompensation employeeId="emp-1" canEdit={false} />);

    expect(await findByText("Not set")).toBeTruthy();
  });

  it("shows the current (newest) rate formatted as currency", async () => {
    (getPayRates as jest.Mock).mockResolvedValue([makeRate({ amountCents: 2150, payType: "hourly" })]);

    const { findAllByText } = await render(<EmployeeCompensation employeeId="emp-1" canEdit={false} />);

    // Appears once as "Current rate" and once in the history list.
    expect(await findAllByText("$21.50/hr")).toHaveLength(2);
  });

  it("shows an error message when the load fails", async () => {
    (getPayRates as jest.Mock).mockRejectedValue(new Error("network down"));

    const { findByText } = await render(<EmployeeCompensation employeeId="emp-1" canEdit={false} />);

    expect(await findByText("network down")).toBeTruthy();
  });

  it("hides the 'Add rate' toggle when canEdit is false", async () => {
    (getPayRates as jest.Mock).mockResolvedValue([]);

    const { queryByText, findByText } = await render(
      <EmployeeCompensation employeeId="emp-1" canEdit={false} />
    );
    await findByText("Not set");

    expect(queryByText("Add rate")).toBeNull();
  });

  it("shows the 'Add rate' toggle when canEdit is true and opens the form", async () => {
    (getPayRates as jest.Mock).mockResolvedValue([]);

    const { findByText, getByText, getByPlaceholderText } = await render(
      <EmployeeCompensation employeeId="emp-1" canEdit />
    );
    await findByText("Not set");

    await fireEvent.press(getByText("Add rate"));

    expect(getByPlaceholderText("e.g. 21.50")).toBeTruthy();
    expect(getByText("Cancel")).toBeTruthy();
  });

  it("rejects a non-positive amount without calling the API", async () => {
    (getPayRates as jest.Mock).mockResolvedValue([]);

    const { findByText, getByText, getByPlaceholderText } = await render(
      <EmployeeCompensation employeeId="emp-1" canEdit />
    );
    await findByText("Not set");
    await fireEvent.press(getByText("Add rate"));

    await fireEvent.changeText(getByPlaceholderText("e.g. 21.50"), "0");
    await fireEvent.press(getByText("Save rate"));

    expect(await findByText("Enter a valid amount.")).toBeTruthy();
    expect(createPayRate).not.toHaveBeenCalled();
  });

  it("rejects a malformed effective date without calling the API", async () => {
    (getPayRates as jest.Mock).mockResolvedValue([]);

    const { findByText, getByText, getByPlaceholderText } = await render(
      <EmployeeCompensation employeeId="emp-1" canEdit />
    );
    await findByText("Not set");
    await fireEvent.press(getByText("Add rate"));

    await fireEvent.changeText(getByPlaceholderText("e.g. 21.50"), "25");
    await fireEvent.changeText(getByPlaceholderText("YYYY-MM-DD"), "not-a-date");
    await fireEvent.press(getByText("Save rate"));

    expect(await findByText("Effective date must be YYYY-MM-DD.")).toBeTruthy();
    expect(createPayRate).not.toHaveBeenCalled();
  });

  it("submits a valid rate, converting dollars to cents, then reloads and closes the form", async () => {
    (getPayRates as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeRate({ amountCents: 2500 })]);
    (createPayRate as jest.Mock).mockResolvedValue(undefined);

    const { findByText, getByText, getByPlaceholderText, queryByPlaceholderText } = await render(
      <EmployeeCompensation employeeId="emp-1" canEdit />
    );
    await findByText("Not set");
    await fireEvent.press(getByText("Add rate"));

    await fireEvent.changeText(getByPlaceholderText("e.g. 21.50"), "25");
    await fireEvent.changeText(getByPlaceholderText("YYYY-MM-DD"), "2026-02-01");
    await fireEvent.press(getByText("Save rate"));

    await waitFor(() => {
      expect(createPayRate).toHaveBeenCalledWith("emp-1", {
        payType: "hourly",
        amountCents: 2500,
        effectiveDate: "2026-02-01",
        note: null,
      });
    });

    await waitFor(() => expect(queryByPlaceholderText("e.g. 21.50")).toBeNull());
    expect(getPayRates).toHaveBeenCalledTimes(2);
  });

  it("shows an error message when saving fails", async () => {
    (getPayRates as jest.Mock).mockResolvedValue([]);
    (createPayRate as jest.Mock).mockRejectedValue(new Error("save failed"));

    const { findByText, getByText, getByPlaceholderText } = await render(
      <EmployeeCompensation employeeId="emp-1" canEdit />
    );
    await findByText("Not set");
    await fireEvent.press(getByText("Add rate"));

    await fireEvent.changeText(getByPlaceholderText("e.g. 21.50"), "25");
    await fireEvent.changeText(getByPlaceholderText("YYYY-MM-DD"), "2026-02-01");
    await fireEvent.press(getByText("Save rate"));

    expect(await findByText("save failed")).toBeTruthy();
  });
});
