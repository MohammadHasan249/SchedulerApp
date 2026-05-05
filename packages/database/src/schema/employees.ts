import { pgTable, uuid, text, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { branches } from "./branches";
import { jobRoles } from "./job-roles";

export const employeeRoleEnum = pgEnum("employee_role", [
  "org_admin",
  "branch_manager",
  "employee",
]);

export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  // FK to auth.users added via raw SQL after migration — Drizzle can't cross schemas
  authUserId: uuid("auth_user_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: employeeRoleEnum("role").notNull().default("employee"),
  jobRoleId: uuid("job_role_id").references(() => jobRoles.id, { onDelete: "set null" }),
  pinHash: text("pin_hash"),
  maxHoursPerWeek: integer("max_hours_per_week").default(40),
  isActive: boolean("is_active").notNull().default(true),
});

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
