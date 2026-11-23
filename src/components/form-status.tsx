import type { FormState } from "@/app/actions";

export function FormStatus({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <div className="mt-2 space-y-1 text-sm">
      {state.ok && <p className="text-[var(--up)]">{state.ok}</p>}
      {state.error && <p className="text-[var(--down)]">{state.error}</p>}
      {state.details?.length ? (
        <ul className="list-disc pl-5 text-[var(--muted)]">
          {state.details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
