import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { employees } from "./employees";
import { organizations } from "./organizations";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("notifications_employee_created_idx").on(t.employeeId, t.createdAt)]
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
