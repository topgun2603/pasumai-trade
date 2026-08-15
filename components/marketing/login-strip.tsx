import {
  HardHatIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  StoreIcon,
  TractorIcon,
  TruckIcon,
} from "lucide-react";
import Link from "next/link";

import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/**
 * Six doors, one for each kind of person who signs in.
 *
 * Replaces a single "Sign in" button. Six different parties use this platform
 * and they do not think of themselves as one audience — a labour contractor
 * looking for "Manpower" should not have to work out that they are a generic
 * user. Naming each door is also the fastest description of what the platform
 * is: you learn there are farmers, buyers, transport and crew on it before
 * reading a line of copy.
 *
 * Several doors lead to the same place. Franchise and Buyer are one account
 * type with a commercial label between them; Transportation and Manpower are
 * both agencies, differing in what they are contracted for. That is a fact
 * about the internals, and there is no reason to make anyone learn it.
 */
export function LoginStrip({ t, locale }: { t: Dictionary; locale: Locale }) {
  const doors = [
    { as: "admin", label: t.doors.admin, icon: ShieldCheckIcon },
    { as: "farmer", label: t.doors.farmer, icon: TractorIcon },
    { as: "buyer", label: t.doors.franchise, icon: StoreIcon },
    { as: "buyer", label: t.doors.buyer, icon: ShoppingBagIcon },
    { as: "agency", label: t.doors.transport, icon: TruckIcon },
    { as: "agency", label: t.doors.manpower, icon: HardHatIcon },
  ];

  return (
    <div className="bg-secondary/60 border-b">
      <nav
        aria-label={t.doors.label}
        className="mx-auto w-full max-w-6xl px-5"
      >
        {/* Scrolls rather than wrapping on a narrow screen: six items on two
            ragged lines is worse than one line the thumb can push. */}
        <ul className="scrollbar-none flex items-stretch gap-1 overflow-x-auto py-1.5">
          <li className="text-muted-foreground hidden shrink-0 items-center pr-2 text-xs font-medium tracking-wide uppercase lg:flex">
            {t.doors.label}
          </li>
          {doors.map(({ as, label, icon: Icon }) => (
            <li key={label} className="shrink-0">
              <Link
                href={`/${locale}/signin?as=${as}`}
                className="text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-ring flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
