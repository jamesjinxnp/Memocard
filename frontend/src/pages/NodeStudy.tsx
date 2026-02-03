
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { learningPathApi } from "../services/api";
import { StudyHeader } from "../components/study/StudyHeader";
import { Flashcard } from "../components/study/Flashcard";
import { QuizOptions } from "../components/study/QuizOptions";
import { StudyResult } from "../components/study/StudyResult";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

interface StudySessionResult {
    nodeId: number;
    cardsReviewed: number;
    correctCount: number;
    responseTime: number;
    results?: Array<{ vocabId: number; rating: number }>;
}

export default function NodeStudy() {
    const { nodeId } = useParams<{ nodeId: string }>();
    const navigate = useNavigate();

    // State
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [correctCount, setCorrectCount] = useState(0);
    const [startTime, setStartTime] = useState<number>(Date.now());
    const [completionData, setCompletionData] = useState<any>(null);

    // Refs for timing
    const sessionStartRef = useRef<number>(Date.now());

    // 1. Fetch Node Data
    const { data, isLoading, error } = useQuery({
        queryKey: ['node', nodeId],
        queryFn: () => learningPathApi.getNode(parseInt(nodeId!)).then(res => res.data),
        enabled: !!nodeId,
    });

    // 2. Mutation for Completion
    const completeMutation = useMutation({
        mutationFn: (result: StudySessionResult) =>
            learningPathApi.completeNode(result.nodeId, {
                cardsReviewed: result.cardsReviewed,
                correctCount: result.correctCount,
                responseTime: result.responseTime,
                results: result.results // Pass results to API
            }).then(res => res.data),
        onSuccess: (data) => {
            setCompletionData(data);
        },
    });

    // Reset timing on load
    useEffect(() => {
        if (data) {
            setStartTime(Date.now());
            sessionStartRef.current = Date.now();
        }
    }, [data]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
                <Loader2 className="size-12 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Loading lesson...</p>
            </div>
        );
    }

    if (error || !data) {
        return <div>Error loading lesson</div>;
    }

    const vocabulary = data.vocabulary;
    const currentCard = vocabulary[currentIndex];
    const isLastCard = currentIndex === vocabulary.length - 1;

    // State for results
    const [results, setResults] = useState<Array<{ vocabId: number; rating: number }>>([]);

    // Handlers
    const handleExit = () => {
        console.log("🚨 Close button clicked! handleExit triggered");
        const deckId = data?.level?.deckId;
        console.log("📍 deckId:", deckId);
        if (deckId) {
            navigate(`/path/${deckId}`);
        } else {
            console.log("⚠️ No deckId, navigating to /dashboard");
            navigate('/dashboard');
        }
    };

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    const handleAnswer = (isCorrect: boolean) => {
        // Track result
        // Simple heuristic: Correct = 3 (Good), Incorrect = 1 (Again)
        // For more nuance, we could add buttons, but for now this maps to binary quiz
        const rating = isCorrect ? 3 : 1;

        const newResults = [...results, {
            vocabId: currentCard.id,
            rating
        }];
        setResults(newResults);

        if (isCorrect) {
            setCorrectCount(prev => prev + 1);
        }

        if (isLastCard) {
            // Finish Session
            const totalTime = Date.now() - sessionStartRef.current;
            completeMutation.mutate({
                nodeId: parseInt(nodeId!),
                cardsReviewed: vocabulary.length,
                correctCount: isCorrect ? correctCount + 1 : correctCount,
                responseTime: totalTime,
                results: newResults // Pass the accumulated results
            });
        } else {
            // Next Card
            setIsFlipped(false);
            setCurrentIndex(prev => prev + 1);
        }
    };

    if (completionData) {
        return (
            <StudyResult
                result={completionData}
                deckId={data.level.deckId}
            />
        );
    }

    if (completeMutation.isPending) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
                <Skeleton className="size-32 rounded-full" />
                <h2 className="text-2xl font-bold animate-pulse">Saving Progress...</h2>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <StudyHeader
                current={currentIndex + 1}
                total={vocabulary.length}
                onExit={handleExit}
            />

            <main className="flex-1 container max-w-2xl mx-auto flex flex-col items-center justify-center p-4 gap-8">
                <div className="w-full pt-16"> {/* Spacer for header */}
                    <Flashcard
                        vocabulary={currentCard}
                        isFlipped={isFlipped}
                        onFlip={handleFlip}
                    />
                </div>

                <div className="w-full pb-8">
                    <QuizOptions
                        isFlipped={isFlipped}
                        onFlip={handleFlip}
                        onAnswer={handleAnswer}
                    />
                </div>
            </main>
        </div>
    );
}
