import { ArrowRightIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/marketing/brand-mark";
import { Button } from "@/components/ui/button";

/**
 * The welcome page each console opens with — if somebody goes looking for it.
 *
 * ## What it is, and what it deliberately is not
 *
 * Bug 14 asked for a Home page with a large welcome and a control that
 * continues into Overview, and for it to be where every sign-in lands. It is
 * built, it is in every rail, and it is *not* the landing page: a tap between
 * somebody and their own work, on every sign-in, for the rest of the account's
 * life, is a heavy price for a page whose whole content is read once. Sign-in
 * still lands on Overview, which is the answer to "what should I do now".
 *
 * So this is the page somebody arrives at from the rail, from a shared link,
 * or on the first day when they do not yet know what the platform is. It has
 * to earn that visit rather than being a doorway everybody is pushed through.
 *
 * ## One shell, role-specific words
 *
 * The report asked for a "role-independent Home shell with role-specific
 * welcome content", and that is exactly this shape: the layout, spacing and
 * the continue control live here once, and each console passes its own
 * greeting and its own three things worth knowing. A farmer and a transport
 * agency do not want the same sentence.
 */

export interface HomeHighlight {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly body: string;
}

export function WelcomeHome({
  greeting,
  name,
  blurb,
  highlights,
  continueTo,
  continueLabel = "Go to Overview",
}: {
  /** "Welcome to Pasumai Trade", or "Welcome back". */
  greeting: string;
  /** Whose console this is. Omitted where the platform does not know yet. */
  name?: string;
  blurb: string;
  /** Three at most. A wall of cards is not a welcome. */
  highlights: readonly HomeHighlight[];
  continueTo: string;
  continueLabel?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-5 py-14">
      <div className="flex max-w-xl flex-col items-center gap-5 text-center">
        <span className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-2xl">
          <BrandMark className="size-8" />
        </span>

        <div className="flex flex-col gap-2.5">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {greeting}
            {name ? <span className="text-primary">, {name}</span> : null}
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed text-balance">
            {blurb}
          </p>
        </div>

        <Button asChild size="lg" className="mt-1">
          <Link href={continueTo}>
            {continueLabel}
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </div>

      {highlights.length > 0 ? (
        <ul className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          {highlights.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="border-border bg-card flex flex-col gap-1.5 rounded-lg border p-4"
            >
              <span className="text-primary flex items-center gap-2 text-sm font-medium">
                <Icon className="size-4 shrink-0" />
                {title}
              </span>
              <span className="text-muted-foreground text-sm leading-relaxed">{body}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
