import type { ReactNode } from "react";

/**
 * The header every console page wears.
 *
 * Shared between admin and the buyer console so a page cannot arrive with its
 * own idea of heading size or spacing. `aside` is where a page-level action
 * goes — a Register button, a cart trigger.
 *
 * `icon` is a node rather than a component so the header stays ignorant of
 * tints and disc sizes: the page that knows which console it is renders its own
 * badge, and the header only finds it a place to stand.
 */
export function PageHeader({
  title,
  description,
  aside,
  icon,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="border-b px-6 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground max-w-3xl text-sm">{description}</p>
          </div>
        </div>
        {aside}
      </div>
    </header>
  );
}
