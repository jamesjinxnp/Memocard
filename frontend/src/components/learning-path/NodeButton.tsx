
import { memo } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Lock, Star, Check, BookOpen, Swords, Flag, Crown } from "lucide-react";

interface NodeButtonProps {
    node: {
        id: number;
        type: 'lesson' | 'practice' | 'boss' | 'checkpoint';
        order: number;
        vocabCount: number;
    };
    unitOrder: number;
    status: 'locked' | 'available' | 'completed';
    stars: number;
    crowns: number;
    onClick: () => void;
}

export const NodeButton = memo(function NodeButton({ node, unitOrder, status, stars, crowns, onClick }: NodeButtonProps) {

    // 1. Determine Icon based on type & status
    const getIcon = () => {
        if (status === 'locked') return <Lock className="size-5" />;
        if (status === 'completed') return <Check className="size-6 stroke-[3]" />;

        switch (node.type) {
            case 'practice': return <Swords className="size-5" />;
            case 'boss': return <Star className="size-5 fill-current" />;
            case 'checkpoint': return <Flag className="size-5 fill-current" />;
            default: return <BookOpen className="size-5" />;
        }
    };

    // 2. Base styles
    const baseStyles = "relative rounded-full flex items-center justify-center transition-all duration-300 shadow-lg group active:scale-90 z-10";

    // 3. Dynamic size based on type
    const sizeClasses = node.type === 'boss' || node.type === 'checkpoint'
        ? "size-20 border-4 text-2xl"
        : "size-16 border-4 text-xl";

    // 4. State styling
    const stateClasses = {
        locked: "bg-[var(--color-bg-elevated)]/50 border-[var(--color-border-default)]/60 text-[var(--color-text-muted)] cursor-not-allowed opacity-40",
        available: "bg-primary border-primary/60 text-white hover:scale-110 hover:-translate-y-1 node-available-glow",
        completed: "bg-accent-teal border-accent-teal-dark text-white hover:scale-105 hover:brightness-110 node-completed-glow",
    };

    // Crown display logic
    const renderCrowns = () => {
        if (crowns <= 0) return null;
        return (
            <div className="absolute -top-2 -right-2 flex items-center gap-0.5">
                {Array.from({ length: Math.min(crowns, 3) }).map((_, i) => (
                    <Crown key={i} className="size-3.5 text-accent-amber fill-accent-amber" />
                ))}
                {crowns > 3 && <span className="text-[10px] font-bold bg-accent-amber text-black px-1 rounded-full">+{crowns - 3}</span>}
            </div>
        );
    };

    // Stars display logic (for completed nodes)
    const renderStars = () => {
        if (status !== 'completed' || stars === 0) return null;
        return (
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-0.5 whitespace-nowrap">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Star
                        key={i}
                        size={12}
                        className={cn(
                            "fill-current",
                            i < stars ? "text-accent-amber" : "text-[var(--color-text-muted)]"
                        )}
                    />
                ))}
            </div>
        );
    };

    const isDisabled = status === 'locked';

    return (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <button
                        onClick={onClick}
                        disabled={isDisabled}
                        className={cn(baseStyles, sizeClasses, stateClasses[status])}
                        aria-label={`${node.type} node ${node.order + 1}`}
                    >
                        {/* Inner Ring (for depth effect) */}
                        <div className="absolute inset-1 rounded-full border border-white/20 pointer-events-none" />

                        {/* Icon */}
                        <div className="z-10 relative">
                            {getIcon()}
                        </div>

                        {/* Badges */}
                        {renderCrowns()}
                        {renderStars()}
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="flex flex-col items-center gap-1 bg-[var(--color-bg-surface)] border-[var(--color-border-default)]">
                    <p className="font-bold font-display capitalize">Unit {unitOrder + 1} · {node.type} {node.order + 1}</p>
                    <p className="text-xs text-muted-foreground">{node.vocabCount} Words</p>
                    {status === 'locked' && <p className="text-xs text-accent-rose uppercase font-bold tracking-wider">Locked</p>}
                    {status === 'available' && <p className="text-xs text-accent-teal uppercase font-bold tracking-wider animate-pulse">Start Lesson</p>}
                    {status === 'completed' && <p className="text-xs text-accent-amber uppercase font-bold tracking-wider">Review</p>}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
});
