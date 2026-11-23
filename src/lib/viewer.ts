import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { DEFAULT_SERVER, isServer, type Server } from "@/lib/servers";

/** Server to show prices for: explicit ?server=, else the viewer's profile, else Windia. */
export async function resolveServer(param: unknown) {
  const user = await getSessionUser();
  if (isServer(param)) return { server: param as Server, user };
  if (user) {
    const p = await db.query.profile.findFirst({ where: eq(schema.profile.userId, user.id), columns: { server: true } });
    if (p) return { server: p.server, user };
  }
  return { server: DEFAULT_SERVER, user };
}
