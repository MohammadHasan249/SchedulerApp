import { pgTable, uuid, text, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * Named bundles of granular authorizations (e.g. ["salaries:view"]) that an org
 * admin can create and assign to employees. org_admins implicitly hold every
 * permission; other roles gain a capability only via an assigned profile.
 */
export const permissionProfiles = pgTable(
  "permission_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Array of permission keys; see @scheduler/types PERMISSION_KEYS.
    permissions: jsonb("permissions").notNull().default([]).$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("permission_profiles_org_name_unique").on(t.organizationId, t.name)]
);

export type PermissionProfile = typeof permissionProfiles.$inferSelect;
export type NewPermissionProfile = typeof permissionProfiles.$inferInsert;
