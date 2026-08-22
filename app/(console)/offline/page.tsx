import { CloudOffIcon } from "lucide-react";
import type { Metadata } from "next";

import { BrandMark } from "@/components/marketing/brand-mark";

export const metadata: Metadata = {
  title: "No connection",
  robots: { index: false },
};

/**
 * What the installed app shows when a navigation cannot reach the server.
 *
 * Static on purpose, and it must stay that way: the service worker caches this
 * page at install time, so anything it read from a session or a database would
 * be a stranger's data frozen at whatever moment the worker was installed.
 *
 * Under the console root layout rather than the public one because it is the
 * installed app that shows it, and the public site is not what got installed.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
        <BrandMark className="size-6" />
      </span>

      <div className="flex max-w-sm flex-col gap-2">
        <div className="text-muted-foreground flex items-center justify-center gap-2">
          <CloudOffIcon className="size-4" />
          <span className="text-sm">No connection</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Pasumai Trade cannot reach the network
        </h1>
        <p className="text-muted-foreground text-sm">
          Nothing has been lost. Anything you were reading is still on the server, and
          this page will work again as soon as the signal comes back.
        </p>
      </div>

      {/*
        A plain reload, not a router refresh. There is no React running that
        could route anywhere, and the point is to try the network again.
      */}
      <a
        href="/farm"
        className="border-border hover:bg-secondary rounded-lg border px-4 py-2 text-sm transition-colors"
      >
        Try again
      </a>
    </div>
  );
}
