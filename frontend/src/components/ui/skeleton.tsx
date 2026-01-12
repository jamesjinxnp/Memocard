import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'circular' | 'text';
}

function Skeleton({
  className,
  variant = 'default',
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-slate-700/50",
        variant === 'circular' && "rounded-full",
        variant === 'text' && "rounded h-4",
        variant === 'default' && "rounded-lg",
        className
      )}
      {...props}
    />
  )
}

// Pre-built skeleton components for common use cases
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 space-y-3", className)}>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}

function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <Skeleton className="h-4 w-16 mb-2" />
          <Skeleton className="h-8 w-12" />
        </div>
      ))}
    </div>
  )
}

function SkeletonDeck() {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5 space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <Skeleton className="h-8 w-24 rounded-full" />
    </div>
  )
}

function SkeletonFlashcard() {
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="aspect-[3/2] rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 p-6 flex flex-col items-center justify-center animate-pulse">
        <Skeleton className="h-10 w-32 mb-4" />
        <Skeleton className="h-5 w-20 mb-2" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  )
}

export { Skeleton, SkeletonCard, SkeletonStats, SkeletonDeck, SkeletonFlashcard }
