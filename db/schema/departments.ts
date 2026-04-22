import { pgTable, uuid, text } from "drizzle-orm/pg-core";
import { branches } from "./branches";

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const jobRoles = pgTable("job_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  departmentId: uuid("department_id")
    .notNull()
    .references(() => departments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type JobRole = typeof jobRoles.$inferSelect;
export type NewJobRole = typeof jobRoles.$inferInsert;
