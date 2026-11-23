/** MapleStory Classic worlds. Windia is the default. */
export const SERVERS = ["windia", "zenith"] as const;
export type Server = (typeof SERVERS)[number];
export const DEFAULT_SERVER: Server = "windia";

export const SERVER_LABELS: Record<Server, string> = { windia: "Windia", zenith: "Zenith" };

export function isServer(v: unknown): v is Server {
  return typeof v === "string" && (SERVERS as readonly string[]).includes(v);
}
