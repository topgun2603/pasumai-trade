"use client";

import {
  ChevronRightIcon,
  LayoutGridIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";

import { CONSOLE_LOOK } from "@/components/console/console-look";
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
import type { ConsoleKind } from "@/lib/domain/console-kinds";
import { cn } from "@/lib/utils";

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
  consoles,
  children,
}: {
  session: { email?: string; role: Role };
  /**
   * The client consoles an operator can look into.
   *
   * Admin only, and a *view* rather than a way in — see
   * `lib/domain/console-kinds.ts`. Passed in rather than imported so this
   * component stays usable by the farmer and buying shells, which have nobody
   * to look at but themselves.
   */
  consoles?: ReadonlyArray<{ kind: ConsoleKind; label: string; short: string }>;
  /** Anything the console wants on the left — a title, a breadcrumb, nothing. */
  children?: React.ReactNode;
}) {
  const { setTheme } = useTheme();
  const [leaving, setLeaving] = useState(false);
  const pathname = usePathname();

  // The console being looked at, if any — it names the trigger, so the bar says
  // where you are rather than only what you could open.
  const current = consoles?.find((entry) =>
    pathname.startsWith(`/admin/consoles/${entry.kind}`),
  );
  const CurrentIcon = current ? CONSOLE_LOOK[current.kind].icon : LayoutGridIcon;

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

      {consoles && consoles.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-2",
                current ? CONSOLE_LOOK[current.kind].disc : undefined,
              )}
            >
              <CurrentIcon className="size-4" />
              <span className="hidden sm:inline">{current?.label ?? "Consoles"}</span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-72 p-0">
            <DropdownMenuLabel className="flex flex-col gap-0.5 border-b px-3 py-2.5">
              <span className="text-sm font-medium">Look into an account</span>
              <span className="text-muted-foreground text-xs font-normal">
                Read-only. Operations never act as a client.
              </span>
            </DropdownMenuLabel>

            <div className="p-1.5">
              {consoles.map((entry) => {
                const look = CONSOLE_LOOK[entry.kind];
                const here = entry.kind === current?.kind;

                return (
                  <DropdownMenuItem
                    key={entry.kind}
                    asChild
                    /* The row draws its own hover and its own tint, so the
                       menu's default highlight would paint over the colour that
                       tells the rows apart. */
                    className="focus:bg-transparent p-0"
                  >
                    <Link
                      href={`/admin/consoles/${entry.kind}`}
                      className={cn(
                        "hover:bg-accent flex items-center gap-3 rounded-md px-2 py-2 transition-colors",
                        here && look.active,
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg",
                          look.disc,
                        )}
                      >
                        <look.icon className="size-4" />
                      </span>

                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="text-sm font-medium">{entry.label}</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {entry.short}
                        </span>
                      </span>

                      {here ? (
                        <span
                          className={cn("ml-auto size-1.5 shrink-0 rounded-full", look.dot)}
                          aria-label="Open now"
                        />
                      ) : (
                        <ChevronRightIcon className="text-faint ml-auto size-3.5 shrink-0" />
                      )}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

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
