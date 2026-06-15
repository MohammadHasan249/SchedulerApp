import { pgTable, uuid, integer, text, date, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { employees } from "./employees";

export const payTypeEnum = pgEnum("pay_type", ["hourly", "salary"]);

/**
 * Effective-dated compensation history for an employee. The active rate on a
 * given day is the row with the greatest `effectiveDate <= that day`. Keeping
 * history (rather than a single mutable field) is what makes accurate
 * year-to-date / T4 figures possible later, since rates change mid-year.
 */
export const payRates = pgTable(
  "pay_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    payType: payTypeEnum("pay_type").notNull(),
    // Amount in minor units (cents) to avoid floating-point drift. For `hourly`
    // this is cents-per-hour; for `salary` it is cents-per-year. `currency`
    // names the unit (default CAD, since the eventual T4 use case is Canadian).
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("CAD"),
    // Branch-local calendar date this rate takes effect.
    effectiveDate: date("effective_date").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Who recorded it (audit trail); null if that employee is later removed.
    createdByEmployeeId: uuid("created_by_employee_id").references(() => employees.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("pay_rates_employee_effective_idx").on(t.employeeId, t.effectiveDate)]
);

export type PayRate = typeof payRates.$inferSelect;
export type NewPayRate = typeof payRates.$inferInsert;
