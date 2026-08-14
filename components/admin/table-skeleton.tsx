import { Skeleton } from "@/components/ui/skeleton";

/**
 * Standing in for a console page while it renders.
 *
 * Every console route reads the clock at request time, so none of them are
 * prerendered — there is always a server round trip on navigation. These
 * skeletons mirror the real layout closely enough that nothing jumps when the
 * content lands.
 */
export function PageHeaderSkeleton({ tiles = 0 }: { tiles?: number }) {
  return (
    <>
      <header className="border-b px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-[28rem] max-w-full" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
      </header>

      {tiles > 0 ? (
        <div className="bg-border grid grid-cols-2 gap-px border-b lg:grid-cols-4">
          {Array.from({ length: tiles }).map((_, index) => (
            <div key={index} className="bg-card flex items-start gap-3 px-5 py-4">
              <Skeleton className="mt-0.5 size-8 shrink-0 rounded-md" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-busy="true">
      <div className="flex flex-wrap items-center gap-3 px-6 py-4">
        <Skeleton className="h-9 min-w-56 flex-1 sm:max-w-xs" />
        <Skeleton className="h-9 w-72" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <div className="flex-1 border-t">
        <div className="bg-secondary/50 flex items-center gap-6 border-b px-6 py-3">
          {[9, 7, 5, 6, 8].map((width, index) => (
            <Skeleton key={index} className="h-3" style={{ width: `${width}rem` }} />
          ))}
        </div>

        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-6 border-b px-6 py-4">
            <div className="flex items-center gap-2.5" style={{ width: "9rem" }}>
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
            <Skeleton className="h-4" style={{ width: "7rem" }} />
            <Skeleton className="h-4" style={{ width: "5rem" }} />
            <Skeleton className="h-5 rounded-full" style={{ width: "6rem" }} />
            <Skeleton className="h-5 rounded-full" style={{ width: "8rem" }} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t px-6 py-3">
        <Skeleton className="h-4 w-28" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </section>
  );
}

export function CardGridSkeleton({ cards = 9 }: { cards?: number }) {
  return (
    <div className="flex-1 p-6" aria-busy="true">
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <li
            key={index}
            className="bg-card flex flex-col gap-3 rounded-lg border p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <Skeleton className="size-11 shrink-0 rounded-lg" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-6 w-24" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <div className="mt-auto flex items-center gap-2 pt-1">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-20" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
