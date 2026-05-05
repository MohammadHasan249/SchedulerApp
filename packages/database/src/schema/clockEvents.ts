import { pgTable, uuid, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { employees } from "./employees";
import { branches } from "./branches";

export const clockTypeEnum = pgEnum("clock_type", ["clock_in", "clock_out"]);

export const clockEvents = pgTable("clock_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  type: clockTypeEnum("type").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

export type ClockEvent = typeof clockEvents.$inferSelect;
export type NewClockEvent = typeof clockEvents.$inferInsert;
