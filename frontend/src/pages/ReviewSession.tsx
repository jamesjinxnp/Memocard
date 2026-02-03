
import { useParams, useNavigate } from "react-router-dom";
import { useReviewSession } from "../hooks/useReviewSession";
import { StudyHeader } from "../components/study/StudyHeader";
import { Flashcard } from "../components/study/Flashcard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ThumbsUp, Medal } from "lucide-react";

export default function ReviewSession() {
    const { deckId } = useParams<{ deckId: string }>();
    const navigate = useNavigate();

    const {
        currentCard,
        currentIndex,
        totalDue,
        isFlipped,
        isComplete,
        isEmpty,
        isLoading,
        handleFlip,
        handleSubmit,
        stats
    } = useReviewSession(deckId!);

    if (!deckId) return <div>Invalid Deck ID</div>;

    // Loading State
    if (isLoading) {
        return (
            <div className="min-h-screen grid place-items-center bg-background">
                <div className="text-center space-y-4">
                    <Loader2 className="size-12 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground animate-pulse">Loading reviews...</p>
                </div>
            </div>
        );
    }

    // Empty State (All Caught Up)
    if (isEmpty) {
        return (
            <div className="min-h-screen grid place-items-center bg-background p-4">
                <div className="text-center space-y-6 max-w-md">
                    <div className="size-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ThumbsUp className="size-12 text-green-600" />
                    </div>
                    <h1 className="text-3xl font-bold">All Caught Up!</h1>
                    <p className="text-muted-foreground">
                        You have no cards due for review right now.
                        Come back later or learn new words!
                    </p>
                    <Button
                        size="lg"
                        className="w-full"
                        onClick={() => navigate(`/path/${deckId}`)}
                    >
                        Back to Path
                    </Button>
                </div>
            </div>
        );
    }

    // Completion State (Summary)
    if (isComplete) {
        return (
            <div className="min-h-screen bg-background grid place-items-center p-4">
                <Card className="w-full max-w-md border-2 border-border/50 shadow-2xl animate-in zoom-in-50">
                    <CardContent className="p-8 space-y-8 text-center">
                        <div className="relative mx-auto">
                            <div className="absolute inset-0 bg-blue-400/20 blur-xl rounded-full" />
                            <Medal className="relative size-24 text-blue-500 mx-auto animate-bounce" />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold">Session Complete!</h1>
                            <p className="text-muted-foreground">You've successfully reviewed your cards.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/50 p-4 rounded-xl">
                                <span className="text-xs text-muted-foreground font-bold uppercase">Reviewed</span>
                                <div className="text-2xl font-bold">{totalDue}</div>
                            </div>
                            <div className="bg-muted/50 p-4 rounded-xl">
                                <span className="text-xs text-muted-foreground font-bold uppercase">Retention</span>
                                <div className="text-2xl font-bold text-green-500">
                                    {totalDue > 0 ? Math.round((stats.correct / totalDue) * 100) : 0}%
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full h-12 text-lg"
                            onClick={() => navigate(`/path/${deckId}`)}
                        >
                            Return to Path
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Mapping ReviewCard to Flashcard Vocabulary interface
    const vocabulary = currentCard ? {
        id: currentCard.vocabularyId,
        word: currentCard.word,
        definition: currentCard.definition || "Definition missing",
        example: currentCard.example,
        pronunciation: currentCard.pronunciation,
        cefr: currentCard.cefr,
        partOfSpeech: currentCard.partOfSpeech
    } : null;

    if (!vocabulary) return null;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <StudyHeader
                current={currentIndex + 1}
                total={totalDue}
                onExit={() => navigate(`/path/${deckId}`)}
            />

            <main className="flex-1 container max-w-2xl mx-auto flex flex-col items-center justify-center p-4 gap-8">
                <div className="w-full pt-16">
                    <Flashcard
                        vocabulary={vocabulary}
                        isFlipped={isFlipped}
                        onFlip={handleFlip}
                    />
                </div>

                <div className="w-full pb-8">
                    {!isFlipped ? (
                        <Button
                            size="lg"
                            className="w-full h-14 text-lg font-bold shadow-lg"
                            onClick={handleFlip}
                        >
                            Show Answer
                        </Button>
                    ) : (
                        <div className="grid grid-cols-4 gap-2 animate-in slide-in-from-bottom-4">
                            <div className="col-span-1">
                                <Button
                                    variant="outline"
                                    className="w-full h-16 flex flex-col gap-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() => handleSubmit(1)} // Again
                                >
                                    <span className="font-bold">Again</span>
                                    <span className="text-[10px] text-muted-foreground text-red-400">1m</span>
                                </Button>
                            </div>
                            <div className="col-span-1">
                                <Button
                                    variant="outline"
                                    className="w-full h-16 flex flex-col gap-1 border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                                    onClick={() => handleSubmit(2)} // Hard
                                >
                                    <span className="font-bold">Hard</span>
                                    <span className="text-[10px] text-muted-foreground text-orange-400">2d</span>
                                </Button>
                            </div>
                            <div className="col-span-1">
                                <Button
                                    variant="outline"
                                    className="w-full h-16 flex flex-col gap-1 border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                                    onClick={() => handleSubmit(3)} // Good
                                >
                                    <span className="font-bold">Good</span>
                                    <span className="text-[10px] text-muted-foreground text-green-400">3d</span>
                                </Button>
                            </div>
                            <div className="col-span-1">
                                <Button
                                    variant="outline"
                                    className="w-full h-16 flex flex-col gap-1 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                    onClick={() => handleSubmit(4)} // Easy
                                >
                                    <span className="font-bold">Easy</span>
                                    <span className="text-[10px] text-muted-foreground text-blue-400">4d</span>
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
