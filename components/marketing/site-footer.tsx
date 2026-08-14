import { LeafIcon } from "lucide-react";
import Link from "next/link";

import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
  const columns = [
    {
      title: t.footer.platform,
      links: [
        { href: "#how-it-works", label: t.nav.howItWorks },
        { href: "#farmers", label: t.nav.forFarmers },
        { href: "#buyers", label: t.nav.forBuyers },
        { href: "#coverage", label: t.nav.coverage },
      ],
    },
    {
      title: t.footer.signIn,
      links: [
        { href: `/${locale}/signin?as=buyer`, label: t.footer.buyerOrFranchise },
        { href: `/${locale}/signin?as=admin`, label: t.footer.operations },
        { href: `/${locale}/signin`, label: t.footer.allOptions },
      ],
    },
  ];

  return (
    <footer className="border-t">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2.5">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
              <LeafIcon className="size-4" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold tracking-tight">
                Pasumai Trade
              </span>
              <span lang="ta" className="text-faint text-[11px]">
                பசுமை வர்த்தகம்
              </span>
            </span>
          </span>
          <p className="text-muted-foreground max-w-xs text-sm">
            {t.footer.tagline}
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.title} className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">{column.title}</h2>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">{t.footer.contact}</h2>
          <p className="text-muted-foreground text-sm">
            Hosur, Krishnagiri
            <br />
            Tamil Nadu
          </p>
          <a
            href="mailto:trade@pasumai.example"
            className="text-primary text-sm hover:underline"
          >
            trade@pasumai.example
          </a>
        </div>
      </div>

      <div className="border-t">
        <div className="text-faint mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Pasumai Trade. {t.footer.rights}
          </p>
          <p className="max-w-xl">{t.footer.rateNote}</p>
        </div>
      </div>
    </footer>
  );
}
