"use client";

import { useActionState } from "react";
import { importHoldings, removeHolding, setHolding, updateProfile, type FormState } from "@/app/actions";
import { SERVERS, SERVER_LABELS, type Server } from "@/lib/servers";
import { FormStatus } from "./form-status";
import { ItemPicker, type PickedItem } from "./item-picker";

export function QuantityCell({ itemId, quantity }: { itemId: number; quantity: number }) {
  const [, action, pending] = useActionState<FormState, FormData>(setHolding, null);
  return (
    <div className="flex items-center justify-end gap-1">
      <form action={action} className="flex items-center gap-1">
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="mode" value="set" />
        <input
          name="quantity"
          defaultValue={quantity}
          key={quantity}
          className="input w-24 py-1 text-right"
          aria-label="Quantity"
          onBlur={(e) => {
            if (e.currentTarget.value !== String(quantity)) e.currentTarget.form?.requestSubmit();
          }}
          disabled={pending}
        />
      </form>
      <form action={removeHolding}>
        <input type="hidden" name="itemId" value={itemId} />
        <button className="px-1 text-[var(--muted)] hover:text-[var(--down)]" aria-label="Remove" title="Remove">
          ✕
        </button>
      </form>
    </div>
  );
}

export function AddHoldingForm({ initial }: { initial?: PickedItem | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setHolding, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="mode" value="add" />
      <div>
        <span className="label">Item</span>
        <ItemPicker initial={initial} />
      </div>
      <div>
        <label className="label" htmlFor="add-qty">Quantity to add</label>
        <input id="add-qty" name="quantity" className="input" placeholder="e.g. 5 or 1.2k" />
      </div>
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Adding…" : "Add to portfolio"}
      </button>
      <FormStatus state={state} />
    </form>
  );
}

export function ImportForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(importHoldings, null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="import-text">One item per line</label>
        <textarea
          id="import-text"
          name="text"
          rows={6}
          className="input font-mono"
          placeholder={"Zakum Helmet, 1\nIlbi Throwing Stars, 3\n2070006, 2\n50x Red Potion"}
        />
      </div>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="mode" value="add" defaultChecked /> Add to existing
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="mode" value="replace" /> Replace everything
        </label>
      </div>
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Importing…" : "Import"}
      </button>
      <FormStatus state={state} />
    </form>
  );
}

export function ProfileForm({ username, server, isPublic }: { username: string; server: Server; isPublic: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" name="username" defaultValue={username} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="server">Server</label>
        <select id="server" name="server" defaultValue={server} className="input">
          {SERVERS.map((s) => (
            <option key={s} value={s}>{SERVER_LABELS[s]}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublic" defaultChecked={isPublic} />
        Public profile &amp; show on leaderboard
      </label>
      <button className="btn-ghost w-full" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </button>
      <FormStatus state={state} />
    </form>
  );
}
