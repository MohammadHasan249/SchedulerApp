import { pgTable, uuid, date, text, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { employees } from "./employees";

export const timeOffStatusEnum = pgEnum("time_off_status", [
  "pending",
  "approved",
  "denied",
]);

export const timeOffRequests = pgTable("time_off_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: text("reason"),
  status: timeOffStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TimeOffRequest = typeof timeOffRequests.$inferSelect;
export type NewTimeOffRequest = typeof timeOffRequests.$inferInsert;
