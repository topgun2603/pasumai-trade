import {
  Building2Icon,
  HardHatIcon,
  ShoppingBasketIcon,
  SproutIcon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react";

import type { ConsoleKind } from "@/lib/domain/console-kinds";

/**
 * What each console looks like: an icon and a colour of its own.
 *
 * Five rows of identical grey text is a list that has to be read. An operator
 * reaching for this menu mid-telephone-call is not reading it — they are
 * finding the lorry one, and the picture and the colour get them there before
 * the word does.
 *
 * The colours are the chart tokens, so they are the same five the console uses
 * everywhere else and they follow the theme into dark mode. They carry no
 * meaning beyond telling the rows apart, which is the whole job: tone is
 * reserved for urgency on this platform, and none of these is urgent.
 *
 * Kept out of `lib/domain/console-kinds.ts` on purpose — that module is what a
 * console *is*, and is imported by server code that has no business pulling in
 * icon components.
 */
export interface ConsoleLook {
  readonly icon: LucideIcon;
  /** The tinted disc behind the icon. */
  readonly disc: string;
  /** The row background when this is the console you are already in. */
  readonly active: string;
  /** The marker on that row. */
  readonly dot: string;
}

export const CONSOLE_LOOK: Record<ConsoleKind, ConsoleLook> = {
  farmers: {
    icon: SproutIcon,
    disc: "bg-chart-1/12 text-chart-1",
    active: "bg-chart-1/8",
    dot: "bg-chart-1",
  },
  buyers: {
    icon: ShoppingBasketIcon,
    disc: "bg-chart-2/12 text-chart-2",
    active: "bg-chart-2/8",
    dot: "bg-chart-2",
  },
  franchises: {
    icon: Building2Icon,
    disc: "bg-chart-4/12 text-chart-4",
    active: "bg-chart-4/8",
    dot: "bg-chart-4",
  },
  transport: {
    icon: TruckIcon,
    disc: "bg-chart-3/12 text-chart-3",
    active: "bg-chart-3/8",
    dot: "bg-chart-3",
  },
  manpower: {
    icon: HardHatIcon,
    disc: "bg-chart-5/12 text-chart-5",
    active: "bg-chart-5/8",
    dot: "bg-chart-5",
  },
};
