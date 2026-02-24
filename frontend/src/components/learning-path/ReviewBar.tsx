
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, PlayCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ReviewBarProps {
    deckId: string;
    dueData?: {
        totalDue: number;
        relearningCount: number;
        reviewCount: number;
    } | null;
    isLoading?: boolean;
}

export function ReviewBar({ deckId, dueData, isLoading }: ReviewBarProps) {
    const navigate = useNavigate();

    // Don't show if loading or no due cards
    if (isLoading || !dueData || dueData.totalDue === 0) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6 bg-[var(--color-bg-deep)]/90 border-t border-[var(--color-border-default)] backdrop-blur-md animate-in slide-in-from-bottom duration-500">
            <div className="max-w-md mx-auto flex items-center justify-between gap-4">

                {/* Info Section */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="size-12 rounded-full bg-accent-amber/20 flex items-center justify-center animate-pulse">
                            <Bell className="text-accent-amber size-6" />
                        </div>
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center text-[10px] animate-bounce"
                        >
                            {dueData.totalDue}
                        </Badge>
                    </div>

                    <div>
                        <p className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2 font-display">
                            Review Time!
                            <Clock size={12} className="text-[var(--color-text-muted)]" />
                        </p>
                        <div className="flex gap-2 text-xs text-[var(--color-text-secondary)]">
                            <span className="text-accent-rose">{dueData.relearningCount} relearn</span>
                            <span>•</span>
                            <span className="text-accent-sky">{dueData.reviewCount} review</span>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <Button
                    size="lg"
                    className="bg-accent-amber hover:bg-accent-amber-dark text-black font-bold shadow-lg shadow-accent-amber/20"
                    onClick={() => navigate(`/study/multi?deck=${deckId}&context=path`)}
                >
                    <PlayCircle className="mr-2 size-5" />
                    Start
                </Button>
            </div>
        </div>
    );
}
