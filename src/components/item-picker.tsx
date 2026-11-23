"use client";

import { useEffect, useId, useRef, useState } from "react";

export type PickedItem = { id: number; gameId: number | null; name: string; category: string | null; iconUrl: string | null };

/**
 * Typeahead combobox over /api/items/search. Submits the chosen item's id via a
 * hidden input named `name`.
 */
export function ItemPicker({
  name = "itemId",
  initial,
  onPick,
}: {
  name?: string;
  initial?: PickedItem | null;
  onPick?: (item: PickedItem | null) => void;
}) {
  const [query, setQuery] = useState(initial?.name ?? "");
  const [picked, setPicked] = useState<PickedItem | null>(initial ?? null);
  const [results, setResults] = useState<PickedItem[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (picked && query === picked.name) return;
    const q = query.trim();
    if (q.length < 2) return; // results are cleared in onChange
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/items/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { items: PickedItem[] };
        setResults(data.items);
        setActive(0);
        setOpen(true);
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, picked]);

  function choose(item: PickedItem) {
    setPicked(item);
    setQuery(item.name);
    setOpen(false);
    onPick?.(item);
  }

  return (
    <div className="relative">
      <div className="relative">
        {picked?.iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picked.iconUrl} alt="" className="pointer-events-none absolute top-1/2 left-2 h-6 w-6 -translate-y-1/2 object-contain" />
        )}
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          className={`input ${picked?.iconUrl ? "pl-10" : ""}`}
          placeholder="Search items…"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length < 2) {
              setResults([]);
              setOpen(false);
            }
            if (picked) {
              setPicked(null);
              onPick?.(null);
            }
          }}
          onFocus={() => results.length && !picked && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (!open || results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + results.length) % results.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(results[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {loading && <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-[var(--muted)]">…</span>}
      </div>
      <input type="hidden" name={name} value={picked?.id ?? ""} />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--muted)]">No tradeable items match.</li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(r);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${i === active ? "bg-[var(--background)]" : ""}`}
              >
                {r.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.iconUrl} alt="" className="h-7 w-7 shrink-0 object-contain" />
                ) : (
                  <span className="h-7 w-7 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{r.name}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {r.category}
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
