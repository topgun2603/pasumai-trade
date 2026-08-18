"use client";

import { LogOutIcon, MonitorIcon, MoonIcon, SunIcon, UserRoundIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, type Role } from "@/lib/auth/claims";
import { signOut } from "@/lib/auth/sign-in";

/**
 * Theme, account and the way out — across the top rather than down the rail.
 *
 * These three sat pinned to the bottom of every navigation rail, below the
 * links. That put the two controls nobody uses often in the position the eye
 * reaches last, and it cost the rail its whole foot: on a short screen the
 * links scrolled while the account block held the space.
 *
 * A top bar is also the only place they can be consistent. There are three
 * rails on this platform — admin, buying and farm — and each had its own copy
 * of a theme toggle and a sign-out button, drifting apart one edit at a time.
 * This is one component, mounted by each layout.
 *
 * The email rather than a friendly name, because operations share machines:
 * knowing *which* account is about to approve a verification matters more than
 * a greeting.
 */
export function ConsoleTopBar({
  session,
  children,
}: {
  session: { email?: string; role: Role };
  /** Anything the console wants on the left — a title, a breadcrumb, nothing. */
  children?: React.ReactNode;
}) {
  const { setTheme } = useTheme();
  const [leaving, setLeaving] = useState(false);

  async function leave() {
    setLeaving(true);
    try {
      await signOut();
      /*
        A full document load, not a router push. A soft navigation keeps the RSC
        cache, so the signed-in shell would render again from memory after the
        cookie is already gone — crossing an auth boundary has to discard
        everything.
      */
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/en/signin");
    } catch {
      setLeaving(false);
      toast.error("Could not sign out. Check your connection.");
    }
  }

  return (
    <header className="bg-background/95 border-border sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b px-4 backdrop-blur">
      <div className="min-w-0 flex-1">{children}</div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Theme">
            <SunIcon className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
            <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <SunIcon className="size-4" />
            Light
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <MoonIcon className="size-4" />
            Dark
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <MonitorIcon className="size-4" />
            System
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <UserRoundIcon className="size-4" />
            {/* The role always, the address only where there is room — on a
                phone the email is what gets cut, because two operators sharing
                a machine are sharing a desk, not a handset. */}
            <span className="hidden max-w-40 truncate sm:inline">
              {session.email ?? ROLE_LABELS[session.role]}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium">
              {session.email ?? "Signed in"}
            </span>
            <span className="text-muted-foreground text-xs font-normal">
              {ROLE_LABELS[session.role]}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={leaving}
            onClick={leave}
          >
            <LogOutIcon className="size-4" />
            {leaving ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
