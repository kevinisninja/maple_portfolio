"use client";

import { useActionState } from "react";
import { createItems, deleteItem, importPrices, savePriceGrid, type FormState } from "@/app/actions";
import type { Server } from "@/lib/servers";
import { mesos } from "@/lib/format";
import { Change } from "@/components/change";
import { FormStatus } from "@/components/form-status";

type Row = {
  id: number;
  name: string;
  category: string | null;
  price: number | null;
  priceDay: string | null;
  prevPrice: number | null;
};

export function PriceGridForm({ server, rows, today }: { server: Server; rows: Row[]; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePriceGrid, null);
  return (
    <>
      <form action={action} id="price-grid">
        <input type="hidden" name="server" value={server} />
      </form>
      <table className="table">
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Current</th>
            <th className="num">vs yesterday</th>
            <th className="num">New price</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <div className="font-medium">{r.name}</div>
                {r.category && <div className="text-xs text-[var(--muted)]">{r.category}</div>}
              </td>
              <td className="num">
                {mesos(r.price)}
                {r.priceDay && r.priceDay !== today && (
                  <div className="text-xs text-[var(--muted)]">from {r.priceDay}</div>
                )}
              </td>
              <td className="num">
                {r.price != null && r.prevPrice != null ? <Change cur={r.price} prev={r.prevPrice} showAbs={false} /> : "—"}
              </td>
              <td className="num">
                <input
                  form="price-grid"
                  name={`price_${r.id}`}
                  className="input w-32 py-1 text-right"
                  placeholder={r.price != null ? String(r.price) : "e.g. 1.5m"}
                  aria-label={`New price for ${r.name}`}
                />
              </td>
              <td>
                <form
                  action={deleteItem}
                  onSubmit={(e) => {
                    if (!confirm(`Delete "${r.name}"? This removes it from every portfolio.`)) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="itemId" value={r.id} />
                  <button className="px-1 text-[var(--muted)] hover:text-[var(--down)]" title="Delete item">✕</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3 p-5">
        <button form="price-grid" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save prices"}
        </button>
        <FormStatus state={state} />
      </div>
    </>
  );
}

export function CreateItemsForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createItems, null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="items-text">One per line: name | category | icon URL</label>
        <textarea
          id="items-text"
          name="text"
          rows={5}
          className="input font-mono"
          placeholder={"Chaos Scroll 60% | Scroll\nWhite Scroll | Scroll\nZakum Helmet | Equip"}
        />
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Adding…" : "Add items"}</button>
      <FormStatus state={state} />
    </form>
  );
}

export function PriceImportForm({ server }: { server: Server }) {
  const [state, action, pending] = useActionState<FormState, FormData>(importPrices, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="server" value={server} />
      <div>
        <label className="label" htmlFor="prices-text">One per line: name, price</label>
        <textarea
          id="prices-text"
          name="text"
          rows={5}
          className="input font-mono"
          placeholder={"Chaos Scroll 60%, 45m\nWhite Scroll, 120m"}
        />
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save prices"}</button>
      <FormStatus state={state} />
    </form>
  );
}
