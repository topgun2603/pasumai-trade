import {
  HardHatIcon,
  ShoppingBagIcon,
  StoreIcon,
  TractorIcon,
  TruckIcon,
} from "lucide-react";
import Link from "next/link";

import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/**
 * Five doors, one for each kind of person who signs in from here.
 *
 * Replaces a single "Sign in" button. Five different parties use this platform
 * and they do not think of themselves as one audience — a labour contractor
 * looking for "Manpower" should not have to work out that they are a generic
 * user. Naming each door is also the fastest description of what the platform
 * is: you learn there are farmers, buyers, transport and crew on it before
 * reading a line of copy.
 *
 * Five doors, five roles. Franchise and Buyer see the same console, and so do
 * Transportation and Manpower, but each signs in as itself — a labour
 * contractor is not a "generic agency", and keeping them apart means the day
 * the two diverge there is nothing to unpick.
 */
export function LoginStrip({ t, locale }: { t: Dictionary; locale: Locale }) {
  /*
    No operations door.

    It was first in the row, which put the one entrance nobody visiting the
    public site can use at the head of a list of five they can. Operations sign
    in at the same page; they do not need to be advertised on it, and a door
    that refuses everybody who reads it is not a door.
  */
  /*
    Farmer first, franchise last.

    The order is the size of the audience each door serves, not the order the
    roles happen to be declared in: growers are who this platform is for and
    who most often arrives not knowing where to click, and a franchise is a
    contracted partner who signs in from a bookmark and does not need the
    prominence. Buyer, transport and crew sit between them in that order
    because that is the sequence a load actually moves through.
  */
  const doors = [
    { as: "farmer", label: t.doors.farmer, icon: TractorIcon },
    { as: "buyer", label: t.doors.buyer, icon: ShoppingBagIcon },
    { as: "transport", label: t.doors.transport, icon: TruckIcon },
    { as: "manpower", label: t.doors.manpower, icon: HardHatIcon },
    { as: "franchise", label: t.doors.franchise, icon: StoreIcon },
  ];

  return (
    <div className="bg-rail text-rail-foreground border-rail-hover border-b">
      <nav
        aria-label={t.doors.label}
        className="mx-auto w-full max-w-6xl px-5"
      >
        {/* Scrolls rather than wrapping on a narrow screen: five items on two
            ragged lines is worse than one line the thumb can push. */}
        <ul className="scrollbar-none flex items-stretch gap-1 overflow-x-auto py-1.5">
          <li className="hidden shrink-0 items-center pr-3 text-xs font-medium tracking-[0.14em] uppercase opacity-65 lg:flex">
            {t.doors.label}
          </li>
          {doors.map(({ as, label, icon: Icon }) => (
            <li key={label} className="shrink-0">
              {/* Pills rather than plain links: on a coloured bar an underline
                  is hard to see and a filled hover state is not. */}
              <Link
                href={`/${locale}/signin?as=${as}`}
                className="hover:bg-rail-hover flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
              >
                <Icon className="size-3.5 shrink-0" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
