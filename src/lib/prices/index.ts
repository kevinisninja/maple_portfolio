import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { PriceProvider } from "./types";
import { IMPLEMENTED as MESOS_WATCH_READY, mesosWatchProvider } from "./mesos-watch";
import { mockProvider } from "./mock";

export type { PriceProvider } from "./types";

/** How long a fetched price is considered fresh. */
export const PRICE_TTL_MINUTES = 15;
/** After a failed fetch, wait this long before trying that item again. */
export const PRICE_RETRY_MINUTES = 1;
/** Per-request budget for talking to the provider. */
export const PRICE_FETCH_TIMEOUT_MS = 5000;

/** The active provider per PRICE_PROVIDER, or null for manual-only pricing. */
export function getProvider(): PriceProvider | null {
  switch (process.env.PRICE_PROVIDER) {
    case "mesos.watch":
      return MESOS_WATCH_READY && process.env.MESOS_WATCH_API_KEY ? mesosWatchProvider : null;
    case "mock":
      return mockProvider(() =>
        db
          .select({ name: schema.item.name, gameId: schema.item.gameId })
          .from(schema.item)
          .where(and(eq(schema.item.tradeable, true), eq(schema.item.hidden, false))),
      );
    default:
      return null;
  }
}

export function providerStatus(): { configured: boolean; label: string; note?: string } {
  const p = getProvider();
  if (p) return { configured: true, label: p.label };
  if (process.env.PRICE_PROVIDER === "mesos.watch") {
    return {
      configured: false,
      label: "mesos.watch",
      note: MESOS_WATCH_READY ? "MESOS_WATCH_API_KEY is not set" : "Adapter not implemented yet",
    };
  }
  return { configured: false, label: "None", note: "Manual prices only" };
}
