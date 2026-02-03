
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
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6 bg-slate-950/80 border-t border-slate-800 backdrop-blur-md animate-in slide-in-from-bottom duration-500">
            <div className="max-w-md mx-auto flex items-center justify-between gap-4">

                {/* Info Section */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="size-12 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
                            <Bell className="text-amber-500 size-6" />
                        </div>
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center text-[10px] animate-bounce"
                        >
                            {dueData.totalDue}
                        </Badge>
                    </div>

                    <div>
                        <p className="text-sm font-bold text-slate-100 flex items-center gap-2">
                            Review Time!
                            <Clock size={12} className="text-slate-400" />
                        </p>
                        <div className="flex gap-2 text-xs text-slate-400">
                            <span className="text-red-400">{dueData.relearningCount} relearn</span>
                            <span>•</span>
                            <span className="text-blue-400">{dueData.reviewCount} review</span>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <Button
                    size="lg"
                    className="bg-amber-500 hover:bg-amber-600 text-black font-bold shadow-lg shadow-amber-500/20"
                    onClick={() => navigate(`/review/${deckId}`)}
                >
                    <PlayCircle className="mr-2 size-5" />
                    Start
                </Button>
            </div>
        </div>
    );
}
