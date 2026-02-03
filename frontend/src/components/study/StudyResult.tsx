
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Trophy, ArrowRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface StudyResultProps {
    result: {
        stars: number;
        xpEarned: number;
        crowns: number;
        isNewRecord: boolean;
        nextNodeId: number | null;
    };
    deckId: string;
}

export function StudyResult({ result, deckId }: StudyResultProps) {
    const navigate = useNavigate();

    // Navigate to path map to show unlock animation (Gamification Loop)
    const handleNextLevel = () => {
        if (deckId) {
            navigate(`/path/${deckId}`);
        } else {
            navigate('/dashboard');
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="w-full max-w-md border-2 border-border/50 shadow-2xl animate-in zoom-in-50 duration-500">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-8">

                    {/* Header Animation */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-yellow-400/20 blur-xl rounded-full" />
                        <Trophy className="relative size-24 text-yellow-400 animate-bounce" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight">Level Complete!</h1>
                        <p className="text-muted-foreground">Great job! You learned new words.</p>
                    </div>

                    {/* Stars */}
                    <div className="flex justify-center gap-2">
                        {[1, 2, 3].map((i) => (
                            <Star
                                key={i}
                                className={cn(
                                    "size-12 transition-all duration-700 delay-300",
                                    i <= result.stars
                                        ? "fill-amber-400 text-amber-400 scale-110"
                                        : "text-muted/30"
                                )}
                            />
                        ))}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 w-full">
                        <div className="bg-muted/50 rounded-xl p-4 flex flex-col items-center">
                            <span className="text-xs text-muted-foreground uppercase font-bold">XP Earned</span>
                            <span className="text-2xl font-bold text-primary">+{result.xpEarned}</span>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-4 flex flex-col items-center">
                            <span className="text-xs text-muted-foreground uppercase font-bold">Crowns</span>
                            <div className="flex items-center gap-1 text-2xl font-bold text-amber-500">
                                {result.crowns} <span className="text-sm">👑</span>
                            </div>
                        </div>
                    </div>

                    {/* New Record Badge */}
                    {result.isNewRecord && (
                        <div className="bg-blue-500/10 text-blue-500 px-4 py-2 rounded-full text-sm font-bold animate-pulse">
                            🎉 New High Score!
                        </div>
                    )}

                    {/* Actions */}
                    <div className="w-full space-y-3 pt-4">
                        {result.nextNodeId ? (
                            <Button
                                className="w-full h-12 text-lg font-bold bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 animate-pulse"
                                onClick={handleNextLevel}
                            >
                                Next Level <ArrowRight className="ml-2 size-5" />
                            </Button>
                        ) : (
                            <Button
                                className="w-full h-12 text-lg"
                                variant="outline"
                                onClick={handleNextLevel}
                            >
                                Back to Path
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            className="w-full text-muted-foreground"
                            onClick={() => navigate(`/path/${deckId}`)}
                        >
                            <Home className="mr-2 size-4" /> Go Home
                        </Button>
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}
