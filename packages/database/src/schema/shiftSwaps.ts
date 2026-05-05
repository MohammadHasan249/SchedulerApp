import { pgTable, uuid, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { shifts } from "./shifts";
import { employees } from "./employees";

export const swapStatusEnum = pgEnum("swap_status", [
  "pending",
  "cover_accepted",
  "manager_approved",
  "denied",
]);

export const shiftSwapRequests = pgTable("shift_swap_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  shiftId: uuid("shift_id")
    .notNull()
    .references(() => shifts.id, { onDelete: "cascade" }),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  coverId: uuid("cover_id").references(() => employees.id, { onDelete: "set null" }),
  managerId: uuid("manager_id").references(() => employees.id, { onDelete: "set null" }),
  status: swapStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ShiftSwapRequest = typeof shiftSwapRequests.$inferSelect;
export type NewShiftSwapRequest = typeof shiftSwapRequests.$inferInsert;
