import Link from "next/link";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { SignInButton, SignOutButton } from "./sign-in-button";

export async function Nav() {
  const user = await getSessionUser();
  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link href="/" className="mr-auto font-semibold tracking-tight">
          🍁 Maple Portfolio
        </Link>
        <Link href="/leaderboard" className="text-sm hover:underline">
          Leaderboard
        </Link>
        {user ? (
          <>
            <Link href="/dashboard" className="text-sm hover:underline">
              My portfolio
            </Link>
            {isAdmin(user) && (
              <Link href="/admin/prices" className="text-sm hover:underline">
                Prices
              </Link>
            )}
            <SignOutButton />
          </>
        ) : (
          <SignInButton />
        )}
      </nav>
    </header>
  );
}
