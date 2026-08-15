"use client";

import { LogOutIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type Role } from "@/lib/auth/claims";
import { signOut } from "@/lib/auth/sign-in";

/**
 * Who is signed in, and how to stop being signed in.
 *
 * The email is shown rather than a friendly name because operations share
 * machines: knowing *which* account is about to approve a verification matters
 * more than a greeting.
 */
export function SessionFooter({
  email,
  role,
}: {
  email?: string;
  role: Role;
}) {
  const [pending, setPending] = useState(false);

  async function leave() {
    setPending(true);
    try {
      await signOut();
      // A full document load, not a router push, and the one case where the
      // lint rule below is wrong: a soft navigation keeps the RSC cache, so
      // the signed-in shell would render again from memory after the cookie is
      // already gone. Crossing an auth boundary has to discard everything.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/en/signin");
    } catch {
      setPending(false);
      toast.error("Could not sign out. Check your connection.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-medium" title={email}>
          {email ?? "Signed in"}
        </span>
        <span className="text-muted-foreground text-xs">{ROLE_LABELS[role]}</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={leave}
        disabled={pending}
        className="w-full justify-start"
      >
        <LogOutIcon className="size-4" />
        {pending ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
