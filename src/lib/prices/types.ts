import type { Server } from "@/lib/servers";

export type ProviderItem = {
  externalId: string;
  name: string;
  /** The game's item ID, if the provider exposes it — preferred for matching. */
  gameId?: number | null;
  category?: string | null;
  iconUrl?: string | null;
};

/**
 * An automated price source. Implement this to plug in a new feed; nothing else
 * in the app needs to change.
 */
export interface PriceProvider {
  /** Stored in item_price.source, e.g. "mesos.watch". */
  readonly id: string;
  readonly label: string;
  /** Max external IDs per fetchPrices call. */
  readonly maxBatchSize: number;

  /** Current price in mesos per external ID. IDs missing from the result count as failures. */
  fetchPrices(server: Server, externalIds: string[], signal: AbortSignal): Promise<Map<string, number>>;

  /**
   * Optional: derive the provider's ID from a game item ID. When present, any
   * catalog item with a game_id is priced automatically, no mapping needed.
   */
  externalIdForGameId?(gameId: number): string;

  /** Optional: the provider's item list, used to map provider items onto our catalog. */
  listItems?(signal: AbortSignal): Promise<ProviderItem[]>;
}
