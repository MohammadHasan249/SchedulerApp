import { pgTable, uuid, timestamp, boolean, integer, unique } from "drizzle-orm/pg-core";
import { branches } from "./branches";
import { jobRoles } from "./job-roles";
import { employees } from "./employees";

export const shifts = pgTable("shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  isPublished: boolean("is_published").notNull().default(false),
});

export const shiftAssignments = pgTable(
  "shift_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    jobRoleId: uuid("job_role_id").references(() => jobRoles.id, { onDelete: "set null" }),
  },
  (t) => [unique("shift_assignments_shift_emp_unique").on(t.shiftId, t.employeeId)]
);

export const shiftRoleRequirements = pgTable(
  "shift_role_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    jobRoleId: uuid("job_role_id")
      .notNull()
      .references(() => jobRoles.id, { onDelete: "cascade" }),
    headcount: integer("headcount").notNull().default(1),
  },
  (t) => [unique("shift_role_requirements_shift_role_unique").on(t.shiftId, t.jobRoleId)]
);

export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;
export type ShiftAssignment = typeof shiftAssignments.$inferSelect;
export type ShiftRoleRequirement = typeof shiftRoleRequirements.$inferSelect;
