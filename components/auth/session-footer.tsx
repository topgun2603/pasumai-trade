"use client";

import { LogOutIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
  labels,
}: {
  /**
   * Optional, and English when absent.
   *
   * Only the farm console has a dictionary; the other four are staff surfaces
   * operated in English. Making this required would force four callers to pass
   * translations that do not exist yet.
   */
  labels?: { signOut: string; signingOut: string; role?: string };
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
      Sign out, and nothing above it.

      This carried the signed-in address and the role, under a header that
      already names the account — the same person identified twice, a few
      centimetres apart, on every console. The header is where somebody looks
      to check whose console they are in; this is where they look to leave.

      `email` and `role` went with it. Sign-out is a document load to the
      sign-in page and consults neither, so keeping them would have been two
      props nobody reads — which drift, and then mislead.
    */
    <div className="flex flex-col gap-2">
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
