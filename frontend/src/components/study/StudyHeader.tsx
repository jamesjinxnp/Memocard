
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, Heart } from "lucide-react";

interface StudyHeaderProps {
    current: number;
    total: number;
    hearts?: number; // Optional lives system for future
    onExit: () => void;
}

export function StudyHeader({ current, total, hearts, onExit }: StudyHeaderProps) {
    const progress = Math.min(100, (current / total) * 100);

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b p-4">
            <div className="container max-w-2xl mx-auto flex items-center justify-between gap-4">
                <Button variant="ghost" size="icon" onClick={() => { console.log("🔘 X Button clicked in StudyHeader"); onExit(); }} className="shrink-0 cursor-pointer hover:bg-destructive/10">
                    <X className="size-6 text-muted-foreground hover:text-destructive transition-colors" />
                </Button>

                <div className="flex-1">
                    <Progress value={progress} className="h-3" />
                </div>

                {hearts !== undefined && (
                    <div className="flex items-center gap-1 text-red-500 font-bold">
                        <Heart className="size-5 fill-current" />
                        <span>{hearts}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
