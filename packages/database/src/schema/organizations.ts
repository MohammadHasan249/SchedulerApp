import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export type OrganizationTheme = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
};

// Keys are day-of-week strings "0"–"6". A missing key means the day is closed.
export type HoursSchedule = Record<string, { startTime: string; endTime: string }>;

const DEFAULT_HOURS: HoursSchedule = {
  "0": { startTime: "09:00", endTime: "23:00" },
  "1": { startTime: "09:00", endTime: "23:00" },
  "2": { startTime: "09:00", endTime: "23:00" },
  "3": { startTime: "09:00", endTime: "23:00" },
  "4": { startTime: "09:00", endTime: "23:00" },
  "5": { startTime: "09:00", endTime: "23:00" },
  "6": { startTime: "09:00", endTime: "23:00" },
};

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#3b82f6"),
  theme: jsonb("theme").default({
    primary: "#3b82f6",
    secondary: "#64748b",
    accent: "#06b6d4",
    background: "#ffffff",
    foreground: "#000000",
  }),
  hoursSchedule: jsonb("hours_schedule").$type<HoursSchedule>().default(DEFAULT_HOURS).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
