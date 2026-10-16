export function MarketCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <div className="flex gap-2">
        <div className="h-5 w-14 animate-pulse rounded-full bg-sunk motion-reduce:animate-none" />
        <div className="h-5 w-24 animate-pulse rounded-full bg-sunk motion-reduce:animate-none" />
      </div>
      <div className="h-4 w-3/4 animate-pulse rounded bg-sunk motion-reduce:animate-none" />
      <div className="h-7 w-32 animate-pulse rounded bg-sunk motion-reduce:animate-none" />
      <div className="h-1.5 w-full animate-pulse rounded-full bg-sunk motion-reduce:animate-none" />
      <div className="h-8 w-full animate-pulse rounded bg-sunk motion-reduce:animate-none" />
      <div className="mt-auto grid grid-cols-4 gap-2 border-t border-line pt-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-sunk motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
