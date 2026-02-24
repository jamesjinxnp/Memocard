
import { Progress } from "@/components/ui/progress";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnitHeaderProps {
    unit: {
        id: number;
        name: string;
        description: string | null;
        icon: string | null;
        color: string | null;
    };
    progress: {
        completedNodes: number;
        totalNodes: number;
    };
    isLocked?: boolean;
}

export function UnitHeader({ unit, progress, isLocked = false }: UnitHeaderProps) {
    const percentage = Math.min(
        100,
        Math.max(0, (progress.completedNodes / progress.totalNodes) * 100)
    );

    return (
        <div className={cn(
            "w-full rounded-2xl overflow-hidden transition-all duration-300",
            "bg-[var(--color-bg-surface)]/80 backdrop-blur-xl",
            "border border-[var(--color-border-default)]/50",
            "shadow-lg shadow-black/20",
            isLocked ? "opacity-50 grayscale" : "opacity-100"
        )}>
            {/* Gradient top accent */}
            <div className="h-[2px] w-full gradient-primary" />

            <div className="p-3 sm:p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className={cn(
                        "size-10 rounded-xl flex items-center justify-center text-xl shrink-0",
                        isLocked
                            ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]"
                            : "gradient-primary text-white shadow-sm shadow-primary/20"
                    )}>
                        {isLocked ? <Lock size={18} /> : unit.icon || '📘'}
                    </div>

                    {/* Text */}
                    <div className="min-w-0">
                        <h3 className="font-bold text-base leading-tight flex items-center gap-2 font-display">
                            {unit.name}
                            {percentage === 100 && !isLocked && (
                                <span className="text-accent-teal text-[10px] bg-accent-teal/10 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                                    Done
                                </span>
                            )}
                        </h3>
                        <p className="text-xs text-[var(--color-text-muted)] line-clamp-1">
                            {unit.description || "Start learning new words now!"}
                        </p>
                    </div>
                </div>

                {/* Progress */}
                {!isLocked && progress.totalNodes > 0 && (
                    <div className="w-28 shrink-0">
                        <div className="flex justify-between text-[10px] mb-1 font-bold text-[var(--color-text-muted)]">
                            <span>{progress.completedNodes}/{progress.totalNodes}</span>
                            <span>{Math.round(percentage)}%</span>
                        </div>
                        <Progress value={percentage} className="h-1.5" />
                    </div>
                )}
            </div>
        </div>
    );
}
