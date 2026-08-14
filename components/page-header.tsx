import type { ReactNode } from "react";

/**
 * The header every console page wears.
 *
 * Shared between admin and the buyer console so a page cannot arrive with its
 * own idea of heading size or spacing. `aside` is where a page-level action
 * goes — a Register button, a cart trigger.
 */
export function PageHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <header className="border-b px-6 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground max-w-3xl text-sm">{description}</p>
        </div>
        {aside}
      </div>
    </header>
  );
}
