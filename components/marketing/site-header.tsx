"use client";

import { LeafIcon, MenuIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useState } from "react";

import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

function ThemeToggle({ label }: { label: string }) {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          <SunIcon className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
          <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const [open, setOpen] = useState(false);

  const links = [
    { href: "#bargaining", label: t.nav.pricing },
    { href: "#languages", label: t.nav.languages },
    { href: "#how-it-works", label: t.nav.howItWorks },
    { href: "#farmers", label: t.nav.forFarmers },
    { href: "#buyers", label: t.nav.forBuyers },
    { href: "#coverage", label: t.nav.coverage },
  ];

  return (
    <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-5">
        <Link
          href={`/${locale}`}
          className="focus-visible:ring-ring flex items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
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
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary focus-visible:ring-ring rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher current={locale} label={t.common.changeLanguage} />
          <ThemeToggle label={t.nav.theme} />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href={`/${locale}/signin`}>{t.nav.signIn}</Link>
          </Button>
          <Button asChild className="hidden md:inline-flex">
            <a href="#apply">{t.nav.requestAccount}</a>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-label={t.nav.menu}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <MenuIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className={cn("border-t lg:hidden", open ? "block" : "hidden")}>
        <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-5 py-3">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md px-3 py-2 text-sm"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-2 flex flex-col gap-2">
            <Button asChild variant="outline">
              <Link href={`/${locale}/signin`}>{t.nav.signIn}</Link>
            </Button>
            <Button asChild>
              <a href="#apply" onClick={() => setOpen(false)}>
                {t.nav.requestAccount}
              </a>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
