
import { Card, CardContent } from "@/components/ui/card";
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
    // Calculate percentage, capped at 100
    const percentage = Math.min(
        100,
        Math.max(0, (progress.completedNodes / progress.totalNodes) * 100)
    );

    // Dynamic color class mapping (safe fallback)
    // const colorClass = unit.color || "bg-primary";

    // Using style for dynamic background color from API if needed, 
    // but try to rely on Tailwind classes where possible.
    // Assuming unit.color returns a tailwind color name like "emerald-500"

    return (
        <Card className={cn(
            "w-full mb-6 border-b-4 overflow-hidden transition-all duration-300",
            isLocked ? "opacity-60 grayscale" : "opacity-100"
        )}>
            <div className={cn(
                "h-2 w-full",
                // We construct the background class dynamically. 
                // Note: Tailwind compilation needs these classes to be present.
                // We might need a safeguard map if `unit.color` is arbitrary.
                `bg-${unit.color || 'primary'}`
            )} />

            <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {/* Icon Container */}
                    <div className={cn(
                        "size-12 rounded-xl flex items-center justify-center text-2xl shadow-sm",
                        isLocked ? "bg-muted text-muted-foreground" : `bg-${unit.color || 'primary'}/20`
                    )}>
                        {isLocked ? <Lock size={20} /> : unit.icon || '📘'}
                    </div>

                    {/* Text Info */}
                    <div>
                        <h3 className="font-bold text-lg leading-tight flex items-center gap-2">
                            {unit.name}
                            {percentage === 100 && !isLocked && (
                                <span className="text-green-500 text-xs bg-green-500/10 px-2 py-0.5 rounded-full">
                                    COMPLETED
                                </span>
                            )}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                            {unit.description || "Start learning new words now!"}
                        </p>
                    </div>
                </div>

                {/* Progress (Only show if unlocked and not empty) */}
                {!isLocked && progress.totalNodes > 0 && (
                    <div className="hidden sm:block w-32">
                        <div className="flex justify-between text-xs mb-1 font-medium text-muted-foreground">
                            <span>{progress.completedNodes}/{progress.totalNodes}</span>
                            <span>{Math.round(percentage)}%</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
