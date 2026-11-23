"use client";

import { useFormStatus } from "react-dom";
import { removeItem } from "@/app/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-ghost w-full text-[var(--down)]" disabled={pending}>
      {pending ? "Removing…" : "Remove item from site"}
    </button>
  );
}

/** Admin-only. Confirms first, since it clears the item from every portfolio. */
export function RemoveItemButton({ itemId, name, holders }: { itemId: number; name: string; holders: number }) {
  return (
    <form
      action={removeItem}
      onSubmit={(e) => {
        const who = holders ? `\n\n${holders} portfolio${holders === 1 ? "" : "s"} hold it; it will be removed from them.` : "";
        if (!confirm(`Remove "${name}" from the site?${who}\n\nYou can restore it later from the Prices page.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="itemId" value={itemId} />
      <Submit />
    </form>
  );
}
