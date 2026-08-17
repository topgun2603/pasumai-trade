import {
  BuildingIcon,
  ShieldIcon,
  SproutIcon,
  StoreIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Who somebody is, in a colour.
 *
 * Every screen on this platform is a list of names — a buyer, a farmer, an
 * agency, a crew — rendered as identical grey text, so telling "who is buying
 * this" from "who is carrying it" meant reading the column heading and counting
 * across. On a phone, in a field, that is most of the work of using the page.
 *
 * So the colour means the **kind of party**, not the individual. That is the
 * distinction worth making automatic: a farmer scanning their sales wants to
 * see at a glance which name is the buyer and which is the lorry, and they
 * already know their own buyers by name. Colouring per person would give six
 * hues that mean nothing and leave the two roles looking alike again.
 *
 * One tag component rather than a colour per screen, because the whole value is
 * that blue means the same thing on the sales page as it does in a bargain. A
 * palette applied locally is just decoration.
 */

export type EntityKind =
  | "farmer"
  | "buyer"
  | "franchise"
  | "transport"
  | "manpower"
  | "operations";

/**
 * Drawn from the chart tokens, which are the only palette in this project
 * already tuned for both themes. Each is used at full strength for the text and
 * a tenth for the ground, which keeps contrast on either background rather than
 * relying on a pair of hand-picked shades per mode.
 */
const STYLES: Record<EntityKind, { className: string; icon: typeof StoreIcon; label: string }> = {
  farmer: {
    // Green: the thing being grown, and the platform's own colour.
    className: "border-chart-1/30 bg-chart-1/10 text-chart-1",
    icon: SproutIcon,
    label: "Farmer",
  },
  buyer: {
    // Blue: money coming in. The one a farmer looks for first.
    className: "border-chart-2/30 bg-chart-2/10 text-chart-2",
    icon: StoreIcon,
    label: "Buyer",
  },
  franchise: {
    className: "border-chart-4/30 bg-chart-4/10 text-chart-4",
    icon: BuildingIcon,
    label: "Franchise",
  },
  transport: {
    // Orange: movement. Distinct from the buying colours on purpose — these
    // two appear side by side on the sales page and must never be confused.
    className: "border-chart-3/30 bg-chart-3/10 text-chart-3",
    icon: TruckIcon,
    label: "Transport",
  },
  manpower: {
    className: "border-chart-5/30 bg-chart-5/10 text-chart-5",
    icon: UsersIcon,
    label: "Crew",
  },
  operations: {
    // Deliberately colourless. Operations are not a party to a trade, and a
    // hue here would suggest they are one of the sides.
    className: "border-border bg-secondary text-muted-foreground",
    icon: ShieldIcon,
    label: "Operations",
  },
};

/** What the tag would say if it had no name to show. */
export function entityLabel(kind: EntityKind): string {
  return STYLES[kind].label;
}

export function EntityTag({
  kind,
  name,
  /** Drops the icon and tightens the padding, for a table cell. */
  compact = false,
  className,
}: {
  kind: EntityKind;
  name: string;
  compact?: boolean;
  className?: string;
}) {
  const style = STYLES[kind];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border font-medium",
        compact ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm",
        style.className,
        className,
      )}
      // The colour carries the role, and colour alone is not something everyone
      // can read. The label says it in words for anyone listening.
      title={`${style.label}: ${name}`}
    >
      {!compact ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="sr-only">{style.label}: </span>
      <span className="truncate">{name}</span>
    </span>
  );
}
