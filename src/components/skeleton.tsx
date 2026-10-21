import { cn } from "./ui";

/** Grey placeholder block, shown only while a screen's data is on its way. */
export function Bone({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-2xl bg-chip motion-reduce:animate-none", className)} />;
}

export function CustomerPageSkeleton() {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-col gap-5 px-5 pt-5 md:px-0 md:pt-8">
      <Bone className="h-9 w-48" />
      <Bone className="h-4 w-64" />
      <div className="grid gap-4 md:grid-cols-2">
        <Bone className="h-40" />
        <Bone className="h-40" />
      </div>
      <Bone className="h-24" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Bone className="h-44" />
        <Bone className="h-44" />
        <Bone className="hidden h-44 md:block" />
        <Bone className="hidden h-44 md:block" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-col gap-6">
      <Bone className="h-10 w-56" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Bone key={i} className="h-32" />
        ))}
      </div>
      <Bone className="h-80" />
      <Bone className="h-64" />
    </div>
  );
}
