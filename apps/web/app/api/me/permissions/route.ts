import { NextResponse } from "next/server";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { getEmployeePermissions } from "@/lib/auth/permissions";

// The caller's own effective permission keys. Clients use this to gate UI
// (e.g. showing salaries); every endpoint still enforces permissions itself.
export const GET = withAuth(async function GET() {
  const user = await getUser();
  const permissions = await getEmployeePermissions(user);
  return NextResponse.json({ permissions: [...permissions] });
});
