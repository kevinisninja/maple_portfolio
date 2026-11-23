import "server-only";
import type { Server } from "@/lib/servers";
import type { PriceProvider, ProviderItem } from "./types";

/**
 * mesos.watch API adapter — NOT YET IMPLEMENTED.
 *
 * Waiting on API access. To finish it, fill in the TODOs below from their docs:
 *  - how the key is sent (header name / query param)
 *  - the bulk price endpoint, how the server (Windia/Zenith) is selected, and
 *    which response field is the price (median? lowest listing?)
 *  - the item list endpoint and its identifier field (game item ID, slug, …)
 * Then set `IMPLEMENTED = true` and, in Vercel, PRICE_PROVIDER=mesos.watch plus
 * MESOS_WATCH_API_KEY.
 */
export const IMPLEMENTED = false;

const BASE_URL = process.env.MESOS_WATCH_BASE_URL ?? "https://mesos.watch/api";

// TODO: map our server names to the provider's world identifiers.
const WORLD: Record<Server, string> = { windia: "windia", zenith: "zenith" };

async function request<T>(path: string, params: Record<string, string>, signal: AbortSignal): Promise<T> {
  const key = process.env.MESOS_WATCH_API_KEY;
  if (!key) throw new Error("MESOS_WATCH_API_KEY is not set");
  const url = new URL(path.replace(/^\//, ""), BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    signal,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${key}`, // TODO: confirm auth scheme
    },
  });
  if (!res.ok) throw new Error(`mesos.watch ${res.status} ${res.statusText} for ${url.pathname}`);
  return res.json() as Promise<T>;
}

export const mesosWatchProvider: PriceProvider = {
  id: "mesos.watch",
  label: "mesos.watch",
  maxBatchSize: 100, // TODO: confirm the API's limit

  async fetchPrices(server, externalIds, signal) {
    // TODO: replace with the real endpoint + response shape.
    const data = await request<{ items: { id: string; price: number }[] }>(
      "/prices",
      { world: WORLD[server], ids: externalIds.join(",") },
      signal,
    );
    return new Map(data.items.map((i) => [String(i.id), Number(i.price)]));
  },

  async listItems(signal): Promise<ProviderItem[]> {
    // TODO: replace with the real endpoint + response shape.
    const data = await request<{ items: { id: string; name: string }[] }>("/items", {}, signal);
    return data.items.map((i) => ({ externalId: String(i.id), name: i.name }));
  },
};
