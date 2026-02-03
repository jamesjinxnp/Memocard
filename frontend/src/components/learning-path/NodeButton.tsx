
import { memo } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Lock, Star, Check, BookOpen, Swords, Flag } from "lucide-react";

interface NodeButtonProps {
    node: {
        id: number;
        type: 'lesson' | 'practice' | 'boss' | 'checkpoint';
        order: number;
        vocabCount: number;
    };
    status: 'locked' | 'available' | 'completed';
    stars: number;
    crowns: number;
    onClick: () => void;
}

export const NodeButton = memo(function NodeButton({ node, status, stars, crowns, onClick }: NodeButtonProps) {
    // Debug: Track re-renders (remove in production)
    console.log('PathNode rendered', node.id);

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
    const baseStyles = "relative rounded-full flex items-center justify-center transition-all duration-300 shadow-lg group active:scale-90";

    // 3. Dynamic size based on type
    const sizeClasses = node.type === 'boss' || node.type === 'checkpoint'
        ? "size-20 border-4 text-2xl"
        : "size-16 border-4 text-xl";

    // 4. State styling
    const stateClasses = {
        locked: "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed hover:bg-slate-800",
        available: "bg-primary border-primary-foreground text-primary-foreground hover:scale-110 hover:-translate-y-1 animate-pulse shadow-primary/40",
        completed: "bg-green-500 border-green-600 text-white hover:scale-105 hover:bg-green-400 shadow-green-500/40",
    };

    // Crown display logic
    const renderCrowns = () => {
        if (crowns <= 0) return null;
        return (
            <div className="absolute -top-2 -right-2 flex">
                {Array.from({ length: Math.min(crowns, 3) }).map((_, i) => (
                    <div key={i} className="text-xs">👑</div>
                ))}
                {crowns > 3 && <span className="text-[10px] font-bold bg-amber-400 text-black px-1 rounded-full">+{crowns - 3}</span>}
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
                            i < stars ? "text-amber-400" : "text-slate-600"
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
                <TooltipContent side="top" className="flex flex-col items-center gap-1 bg-slate-900 border-slate-700">
                    <p className="font-bold capitalize">{node.type} {node.order + 1}</p>
                    <p className="text-xs text-muted-foreground">{node.vocabCount} Words</p>
                    {status === 'locked' && <p className="text-xs text-red-400 uppercase font-bold tracking-wider">Locked</p>}
                    {status === 'available' && <p className="text-xs text-green-400 uppercase font-bold tracking-wider animate-pulse">Start Lesson</p>}
                    {status === 'completed' && <p className="text-xs text-amber-400 uppercase font-bold tracking-wider">Review</p>}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
});
