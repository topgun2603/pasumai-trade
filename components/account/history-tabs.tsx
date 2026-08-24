"use client";

import { HandshakeIcon, HistoryIcon, TrendingUpIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * The three things "history" means to somebody on this platform.
 *
 * They were in three places — an audit trail under the profile, a price chart
 * behind a rail item called Prices, and settled bargains on the logistics
 * page. Somebody asking "what has this crop been worth" had to know which of
 * the three to open, and the answer depended on whether they wanted a number,
 * a shape, or a record of who changed it.
 *
 * ## The counts are the point of the design
 *
 * A tab that says how much is behind it is a tab somebody can choose without
 * opening it. Bargains reading 9 and Audits reading 0 answers a question
 * before a click; three bare words do not, and the reader pays for that in
 * round trips on a connection that charges for them.
 *
 * ## Server-rendered panels
 *
 * Only the tab state is client state. Each panel is a server-rendered child
 * handed in as a prop, so switching costs no round trip and the whole page
 * renders without JavaScript running.
 */

const ICONS = {
  bargains: HandshakeIcon,
  revenue: TrendingUpIcon,
  audits: HistoryIcon,
} as const;

export type HistoryTabValue = keyof typeof ICONS;

export function HistoryTabs({
  panels,
}: {
  panels: ReadonlyArray<{
    value: HistoryTabValue;
    label: string;
    /** Shown on the tab. Omitted where a count would be meaningless. */
    count?: number;
    content: ReactNode;
  }>;
}) {
  return (
    <Tabs defaultValue={panels[0]?.value} className="flex flex-col gap-5">
      {/*
        A segmented control rather than the default underline: three peers of
        equal weight, one of which is on. An underline reads as a place in a
        sequence, and these are not steps.
      */}
      {/*
        A sunken track with the live tab raised out of it.

        The first attempt tinted the active tab and put the row on a card, so a
        pale tint sat on a pale surface and the selected tab was the hardest
        one to pick out — the opposite of the job. A recessed track gives the
        raised tab something to be raised *from*, which is what makes "on"
        legible without colour doing all the work.
      */}
      <TabsList className="bg-muted h-auto w-fit max-w-full flex-wrap gap-1 rounded-xl p-1">
        {panels.map(({ value, label, count }) => {
          const Icon = ICONS[value];

          return (
            <TabsTrigger
              key={value}
              value={value}
              className="
                text-muted-foreground flex h-auto shrink-0 items-center gap-2
                rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap
                transition-all
                hover:text-foreground
                data-[state=active]:bg-background
                data-[state=active]:text-foreground
                data-[state=active]:shadow-sm
                data-[state=active]:[&_svg]:text-primary
              "
            >
              {/* Colour on the icon alone. The label carries the weight; a
                fully tinted tab competes with the content below it. */}
              <Icon className="size-4 shrink-0 opacity-80 transition-colors" />
              {label}
              {count !== undefined ? (
                /*
                  Toned down at zero rather than hidden. "Audits 0" is a fact
                  somebody wants; a missing badge reads as a tab that has not
                  loaded.
                */
                <span
                  className={
                    count > 0
                      ? "bg-primary/12 text-primary tabular rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold"
                      : "text-faint tabular rounded-full px-1.5 py-0.5 text-[11px] leading-none"
                  }
                >
                  {count}
                </span>
              ) : null}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {panels.map(({ value, content }) => (
        <TabsContent key={value} value={value}>
          {content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
