import { pgTable, uuid, text, unique } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    address: text("address"),
    timezone: text("timezone").notNull().default("UTC"),
  },
  (t) => [unique("branches_org_slug_unique").on(t.organizationId, t.slug)]
);

export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
