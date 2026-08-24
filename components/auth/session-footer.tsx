"use client";

import { LogOutIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ROLE_LABELS, type Role } from "@/lib/auth/claims";
import { Button } from "@/components/ui/button";
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
  labels,
}: {
  /** The login itself. A mobile-OTP account has no address; the role stands in. */
  email?: string;
  role: Role;
  /**
   * Optional, and English when absent.
   *
   * Only the farm console has a dictionary; the other four are staff surfaces
   * operated in English. Making this required would force four callers to pass
   * translations that do not exist yet.
   */
  labels?: { signOut: string; signingOut: string; signedInAs?: string };
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
    /*
      Who is signed in, then the way out.

      The account's own name is in the rail header. This is a different fact:
      *which login* is being used, which on a shared handset or a business with
      two people on one account is the question somebody actually has before
      they sign out of it.

      It was removed with the duplicated name-and-village block above it and
      should not have been — the two looked alike and were not.
    */
    <div className="flex flex-col gap-2">
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-faint text-[11px] tracking-wide uppercase">
          {labels?.signedInAs ?? "Signed in as"}
        </span>
        <span className="truncate text-sm font-medium" title={email}>
          {email ?? ROLE_LABELS[role]}
        </span>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={leave}
        disabled={pending}
        className="w-full justify-start"
      >
        <LogOutIcon className="size-4" />
        {pending
          ? (labels?.signingOut ?? "Signing out…")
          : (labels?.signOut ?? "Sign out")}
      </Button>
    </div>
  );
}
