// Replaces the plain-text "Loading…" ternaries repeated across every page's
// list/section with a shimmer placeholder shaped like the content it stands in for.
export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-emerald-900/[0.08] rounded-lg ${className}`} />;
}

export function SkeletonText({ lines = 1, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }) {
  return (
    <div className={`bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm ${className}`}>
      <Skeleton className="h-3 w-1/3 mb-3" />
      <Skeleton className="h-5 w-2/3 mb-2" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
