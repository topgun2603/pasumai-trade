"use client";

import { CheckIcon, LanguagesIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_META,
  isLocale,
  type Locale,
} from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Remembers the choice so a later visit to `/` lands in the same language
 * rather than falling back to the browser header.
 *
 * A year is long enough to be useful and short enough that a shared device is
 * not stuck in one language forever.
 *
 * Defined at module scope: writing to `document.cookie` inside a component
 * body trips the React Compiler's immutability rule, and this is a side effect
 * on the document rather than component state.
 */
function rememberLocale(locale: Locale): void {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${oneYear}; samesite=lax`;
}

/**
 * Choosing a language.
 *
 * Each option is written in its own script — showing "Malayalam" in Latin to
 * someone who reads Malayalam is the wrong way round, and someone who cannot
 * read the current language needs to recognise their own to escape.
 *
 * The choice both navigates and is remembered in a cookie, so a later visit to
 * `/` lands in the same language rather than falling back to the browser
 * header.
 */
export function LanguageSwitcher({
  current,
  label,
  compact = false,
}: {
  current: Locale;
  label: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function choose(next: Locale) {
    if (next === current) return;

    rememberLocale(next);

    // Swap the first path segment; everything after it is locale-independent.
    const segments = pathname.split("/");
    if (isLocale(segments[1])) {
      segments[1] = next;
    } else {
      segments.splice(1, 0, next);
    }

    router.push(segments.join("/") || `/${next}`);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={compact ? "ghost" : "outline"}
          size={compact ? "icon" : "sm"}
          aria-label={label}
        >
          <LanguagesIcon className="size-4" />
          {compact ? null : (
            <span lang={LOCALE_META[current].tag}>
              {LOCALE_META[current].nativeName}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALES.map((locale) => {
          const meta = LOCALE_META[locale];
          const active = locale === current;
          return (
            <DropdownMenuItem
              key={locale}
              onClick={() => choose(locale)}
              className={cn("gap-2", active && "bg-accent")}
            >
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span lang={meta.tag} className="font-medium">
                  {meta.nativeName}
                </span>
                <span className="text-faint text-xs">
                  {meta.englishName} · {meta.region}
                </span>
              </span>
              {active ? (
                <CheckIcon className="text-primary size-4 shrink-0" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
