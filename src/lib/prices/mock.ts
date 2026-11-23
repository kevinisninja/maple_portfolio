import type { Server } from "@/lib/servers";
import type { PriceProvider, ProviderItem } from "./types";

/**
 * Fake feed for exercising the cache and the charts without a real API.
 * Enable with PRICE_PROVIDER=mock. Prices are deterministic per item, server
 * and 15-minute bucket, and drift on a slow wave plus noise.
 */
export const MOCK_PROVIDER_ID = "mock";
const BUCKET_MS = 15 * 60 * 1000;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 2 ** 32;
}

export function mockPriceAt(externalId: string, server: Server, timeMs: number): number {
  const bucket = Math.floor(timeMs / BUCKET_MS);
  const days = timeMs / 86_400_000;
  const base = 10 ** (4 + hash(externalId) * 5); // 10K – 1B
  const serverSkew = server === "zenith" ? 0.9 + hash(`${externalId}:z`) * 0.2 : 1;
  const trend = (hash(`${externalId}:t`) - 0.45) * 0.004 * (days - 20_700); // slow up/down drift, ~0 near late 2026
  const wave = Math.sin(days / (5 + hash(`${externalId}:w`) * 20) + hash(externalId) * 100) * 0.12;
  const noise = (hash(`${externalId}:${server}:${bucket}`) - 0.5) * 0.04;
  return Math.max(1, Math.round(base * serverSkew * (1 + trend + wave + noise)));
}

export function mockProvider(catalog: () => Promise<{ name: string }[]>): PriceProvider {
  return {
    id: MOCK_PROVIDER_ID,
    label: "Mock feed (testing)",
    maxBatchSize: 500,

    async fetchPrices(server, externalIds) {
      const now = Date.now();
      return new Map(externalIds.map((id) => [id, mockPriceAt(id, server, now)]));
    },

    async listItems(): Promise<ProviderItem[]> {
      // Pretend the provider carries every item already in our catalog.
      return (await catalog()).map((i) => ({ externalId: `mock:${i.name.toLowerCase()}`, name: i.name }));
    },
  };
}
