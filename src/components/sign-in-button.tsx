"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignInButton({ className = "" }: { className?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      className={`btn-primary ${className}`}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" });
      }}
    >
      {pending ? "Redirecting…" : "Sign in with Google"}
    </button>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="btn-ghost"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
