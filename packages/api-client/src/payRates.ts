import { apiFetch } from "./client";
import type { PayRate, PayType } from "@scheduler/types";

export type CreatePayRatePayload = {
  payType: PayType;
  amountCents: number;
  currency?: string;
  effectiveDate: string; // YYYY-MM-DD
  note?: string | null;
};

/** Full effective-dated pay history for an employee, newest first. */
export function getPayRates(employeeId: string): Promise<PayRate[]> {
  return apiFetch(`/api/employees/${employeeId}/pay-rates`);
}

export function createPayRate(
  employeeId: string,
  payload: CreatePayRatePayload
): Promise<PayRate> {
  return apiFetch(`/api/employees/${employeeId}/pay-rates`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
