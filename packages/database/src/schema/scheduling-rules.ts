import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { branches } from "./branches";

export const schedulingRules = pgTable(
  "scheduling_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    ruleText: text("rule_text").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scheduling_rules_branch_idx").on(t.branchId)]
);

export type SchedulingRule = typeof schedulingRules.$inferSelect;
export type NewSchedulingRule = typeof schedulingRules.$inferInsert;
