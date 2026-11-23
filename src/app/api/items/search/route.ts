import { searchItems } from "@/lib/catalog";

/** Typeahead for the "add item" picker. Public: the catalog isn't sensitive. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").slice(0, 80);
  if (q.trim().length < 2) return Response.json({ items: [] });
  const { items } = await searchItems({ q, limit: 12 });
  return Response.json(
    {
      items: items.map((i) => ({ id: i.id, gameId: i.game_id, name: i.name, category: i.category, iconUrl: i.icon_url })),
    },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
