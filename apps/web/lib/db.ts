import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@scheduler/database/schema";

// Serverless tuning: each Vercel function instance gets its own pool. With the
// postgres-js default (`max: 10`), a moderate burst of traffic exhausts the
// Supabase pooler fast. Cap at 1 connection per instance; let the pooler at
// pooler.supabase.com:6543 do the multiplexing across instances.
const client = postgres(process.env.DATABASE_URL!, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
});

export const db = drizzle(client, { schema });
