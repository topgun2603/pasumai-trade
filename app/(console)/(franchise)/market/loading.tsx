import { CardGridSkeleton } from "@/components/admin/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function MarketLoading() {
  return (
    <>
      <header className="border-b px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-4 w-[30rem] max-w-full" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 border-b px-6 py-4">
        <Skeleton className="h-9 min-w-56 flex-1 sm:max-w-xs" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="ml-auto h-9 w-44" />
      </div>

      <CardGridSkeleton />
    </>
  );
}
