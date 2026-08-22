import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { organizations, jobRoles, branches } from "@scheduler/database/schema";
import { eq } from "drizzle-orm";

export const CACHE_TAGS = {
  orgTheme: (orgId: string) => `org-theme-${orgId}`,
  orgHours: (orgId: string) => `org-hours-${orgId}`,
  jobRoles: (orgId: string) => `job-roles-${orgId}`,
  branches: (orgId: string) => `branches-${orgId}`,
};

export const getCachedOrgTheme = (organizationId: string) =>
  unstable_cache(
    async () => {
      const [org] = await db
        .select({ theme: organizations.theme })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      return org?.theme ?? null;
    },
    [CACHE_TAGS.orgTheme(organizationId)],
    { revalidate: 300, tags: [CACHE_TAGS.orgTheme(organizationId)] }
  )();

export const getCachedOrgHours = (organizationId: string) =>
  unstable_cache(
    async () => {
      const [org] = await db
        .select({ hoursSchedule: organizations.hoursSchedule })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      return org?.hoursSchedule ?? {};
    },
    [CACHE_TAGS.orgHours(organizationId)],
    { revalidate: 300, tags: [CACHE_TAGS.orgHours(organizationId)] }
  )();

export const getCachedJobRoles = (organizationId: string) =>
  unstable_cache(
    async () => {
      return db
        .select()
        .from(jobRoles)
        .where(eq(jobRoles.organizationId, organizationId));
    },
    [CACHE_TAGS.jobRoles(organizationId)],
    { revalidate: 300, tags: [CACHE_TAGS.jobRoles(organizationId)] }
  )();

export const getCachedBranches = (organizationId: string) =>
  unstable_cache(
    async () => {
      return db
        .select()
        .from(branches)
        .where(eq(branches.organizationId, organizationId));
    },
    [CACHE_TAGS.branches(organizationId)],
    { revalidate: 300, tags: [CACHE_TAGS.branches(organizationId)] }
  )();
