import { pgTable, uuid, smallint, time, boolean } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const organizationHours = pgTable("organization_hours", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  dayOfWeek: smallint("day_of_week").notNull(),
  startTime: time("start_time"),
  endTime: time("end_time"),
  isClosed: boolean("is_closed").notNull().default(false),
});

export type OrganizationHours = typeof organizationHours.$inferSelect;
export type NewOrganizationHours = typeof organizationHours.$inferInsert;
