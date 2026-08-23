"use client";

import { BadgeCheckIcon, CreditCardIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * What to say when somebody cannot do the thing they just tried to do.
 *
 * ## The dead end
 *
 * Bug 20: a blocked action produced a message and no way forward. Three
 * screens each did it differently — a toast with an action here, a toast
 * without one there, a red line under a button somewhere else — and a toast is
 * the wrong shape for this in any case. It disappears while somebody is still
 * reading it, and what they needed was not a notification but an explanation
 * and a door.
 *
 * So: one dialog, two reasons, and always a link to the page that clears it.
 *
 * ## Why the reason comes from the server
 *
 * `requireCapability` already answers 402 for a missing subscription and 403
 * for missing verification. The client does not decide which it was — it reads
 * the code off the refusal, because the server is the thing that actually
 * knows, and a client that guesses will eventually send somebody to buy a plan
 * they already have.
 *
 * ## Usage
 *
 * Wrap a console subtree in `GateProvider`, then from anywhere inside it:
 *
 *     const gate = useGate();
 *     if (response.status === 402) return gate.show("subscription", detail);
 *
 * The provider owns one dialog for the whole subtree rather than each caller
 * mounting its own, so two blocked actions in quick succession cannot stack
 * two modals on top of each other.
 */

export type GateReason = "subscription" | "verification";

/** Which console the person is in, so the link goes to their own pages. */
export type GateConsole = "farm" | "buying" | "agency";

const DESTINATION: Record<GateConsole, Record<GateReason, string>> = {
  farm: {
    subscription: "/farm/account/subscription",
    verification: "/farm/account/verification",
  },
  buying: {
    subscription: "/account/subscription",
    verification: "/account/verification",
  },
  agency: {
    subscription: "/agency/profile/subscription",
    verification: "/agency/profile/verification",
  },
};

const COPY: Record<GateReason, { title: string; body: string; cta: string }> = {
  subscription: {
    title: "This needs an active plan",
    body: "Browsing is free. Bargaining, ordering and listing need a subscription — it takes a minute and starts the moment payment clears.",
    cta: "See plans",
  },
  verification: {
    title: "Your documents need checking first",
    body: "Send them once and operations check them, usually within a working day. Nothing else on the platform is held up while you wait.",
    cta: "Send documents",
  },
};

interface GateApi {
  /** `detail` is the server's own wording, shown in place of ours when given. */
  show: (reason: GateReason, detail?: string) => void;
}

const Gate = createContext<GateApi | null>(null);

/**
 * Reaching for the gate outside a provider is a programming error, not a
 * runtime condition — so this throws rather than returning a no-op that
 * silently swallows the one message the person needed to see.
 */
export function useGate(): GateApi {
  const api = useContext(Gate);
  if (!api) throw new Error("useGate needs a <GateProvider> above it");
  return api;
}

export function GateProvider({
  console: which,
  children,
}: {
  console: GateConsole;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<{ reason: GateReason; detail?: string } | null>(null);

  return (
    <Gate.Provider value={{ show: (reason, detail) => setOpen({ reason, detail }) }}>
      {children}

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          {open ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {open.reason === "subscription" ? (
                    <CreditCardIcon className="text-primary size-5" />
                  ) : (
                    <BadgeCheckIcon className="text-primary size-5" />
                  )}
                  {COPY[open.reason].title}
                </DialogTitle>
                <DialogDescription className="text-left">
                  {/*
                    The server's sentence when it sent one. It knows things this
                    component does not — which capability, how many days ago it
                    lapsed — and rewording it here would lose that.
                  */}
                  {open.detail ?? COPY[open.reason].body}
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="gap-2 sm:justify-start">
                <Button asChild onClick={() => setOpen(null)}>
                  <Link href={DESTINATION[which][open.reason]}>
                    {COPY[open.reason].cta}
                  </Link>
                </Button>
                <Button variant="ghost" onClick={() => setOpen(null)}>
                  Not now
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Gate.Provider>
  );
}
