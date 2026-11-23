import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// neon() doesn't connect until the first query, so a placeholder lets `next build`
// import this module without a real database configured.
const sql = neon(process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost/placeholder");

export const db = drizzle({ client: sql, schema });
export { schema };
