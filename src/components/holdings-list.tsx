"use client";

import { useState } from "react";
import Link from "next/link";
import { ItemIcon } from "./item-icon";
import { mesos, fullMesos, pct } from "@/lib/format";
import { Sparkline } from "./sparkline";
import { QuantityCell } from "./holding-forms";

export type HoldingListRow = {
  itemId: number;
  name: string;
  category: string | null;
  iconUrl: string | null;
  quantity: number;
  price: number | null;
  priceDay: string | null;
  value: number;
  prevValue: number;
  spark: number[];
};

/** Categorical slots in fixed order; everything past slot 5 folds into "Other". */
const SLOTS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];
const OTHER = "var(--series-other)";

export function HoldingsList({ rows, editable = false }: { rows: HoldingListRow[]; editable?: boolean }) {
  const [editing, setEditing] = useState(false);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const unpriced = rows.filter((r) => r.price == null).length;

  // Rows arrive sorted by value desc: the five largest get slots 1–5, the tail folds
  // into "Other". The swatch on each row is the legend.
  const segments = rows.slice(0, SLOTS.length).map((r, i) => ({ key: String(r.itemId), name: r.name, value: r.value, color: SLOTS[i] }));
  const otherValue = rows.slice(SLOTS.length).reduce((s, r) => s + r.value, 0);
  if (otherValue > 0) segments.push({ key: "other", name: "Other", value: otherValue, color: OTHER });

  return (
    <section aria-labelledby="holdings-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="holdings-heading" className="text-lg font-semibold">
          Holdings
        </h2>
        <div className="flex items-center gap-3 text-sm">
          {unpriced > 0 && <span className="text-[var(--muted)]">{unpriced} unpriced</span>}
          {editable && rows.length > 0 && (
            <button className="btn-ghost" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
              {editing ? "Done" : "Edit"}
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No items yet.</p>
      ) : (
        <>
          {total > 0 && (
            <div className="mt-4 flex h-2 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Allocation by value">
              {segments
                .filter((s) => s.value > 0)
                .map((s) => (
                  <div
                    key={s.key}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{ flexGrow: s.value, flexBasis: 0, background: s.color }}
                    title={`${s.name}: ${((s.value / total) * 100).toFixed(1)}%`}
                  />
                ))}
            </div>
          )}

          <ul className="mt-2 divide-y divide-[var(--border)]">
            {rows.map((r, i) => {
              const change = pct(r.value, r.prevValue);
              const share = total ? (r.value / total) * 100 : 0;
              return (
                <li key={r.itemId} className="flex items-center gap-3 py-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: i < SLOTS.length ? SLOTS[i] : OTHER }}
                    aria-hidden
                  />
                  <ItemAvatar name={r.name} iconUrl={r.iconUrl} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/items/${r.itemId}`} className="block truncate font-medium hover:underline">
                      {r.name}
                    </Link>
                    <div className="truncate text-xs text-[var(--muted)]">
                      {r.quantity.toLocaleString()} × {mesos(r.price)}
                      <span className="hidden sm:inline"> · {share.toFixed(1)}% of portfolio</span>
                    </div>
                  </div>

                  {editing ? (
                    <QuantityCell itemId={r.itemId} quantity={r.quantity} />
                  ) : (
                    <>
                      <div className="hidden sm:block">
                        <Sparkline values={r.spark} label={`${r.name} price, last 30 days`} />
                      </div>
                      <div className="w-28 shrink-0 text-right">
                        <div className="font-medium tabular-nums" title={fullMesos(r.value)}>
                          {mesos(r.value)}
                        </div>
                        <div className="text-xs tabular-nums">
                          {change == null || change === 0 ? (
                            <span className="text-[var(--muted)]">0.00%</span>
                          ) : (
                            <span className={change > 0 ? "text-[var(--up)]" : "text-[var(--down)]"}>
                              {change > 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function ItemAvatar({ name, iconUrl }: { name: string; iconUrl: string | null }) {
  if (iconUrl) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]">
        <ItemIcon src={iconUrl} size={28} />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--muted)]">
      {initials}
    </span>
  );
}
