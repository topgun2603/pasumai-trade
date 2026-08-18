import { Skeleton } from "@/components/ui/skeleton";

export default function DispatchLoading() {
  return (
    <>
      <header className="border-b px-6 py-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-[34rem] max-w-full" />
        </div>
      </header>

      <div className="flex flex-col gap-6 p-6" aria-busy="true">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card flex flex-col gap-1.5 px-5 py-4">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>

        <Skeleton className="h-6 w-40" />

        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-card flex flex-col gap-4 rounded-lg border p-5">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-52" />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
