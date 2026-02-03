
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { learningPathApi, studyApi } from "../services/api";

interface ReviewCard {
    cardId: string;
    vocabularyId: number;
    word: string;
    definition: string;
    example: string | null;
    pronunciation: string | null;
    cefr: string | null;
    partOfSpeech: string | null;
    due: string;
    state: number;
}

export function useReviewSession(deckId: string) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [stats, setStats] = useState({ correct: 0, incorrect: 0 });

    // Performance tracking
    const startTimeRef = useRef<number>(Date.now());

    // 1. Fetch Due Cards
    const { data, isLoading, error } = useQuery({
        queryKey: ['review-session', deckId],
        queryFn: () => learningPathApi.getDueCards(deckId).then((res: any) => res.data),
        enabled: !!deckId,
        staleTime: 0, // Always fetch fresh
    });

    // 2. Review Mutation
    const reviewMutation = useMutation({
        mutationFn: (data: { cardId: string; rating: number; responseTime: number }) =>
            studyApi.submitReview({
                cardId: data.cardId,
                rating: data.rating,
                studyMode: 'review',
                responseTime: data.responseTime
            })
    });

    const cards: ReviewCard[] = data?.cards || [];
    const currentCard = cards[currentIndex];
    const isComplete = !isLoading && cards.length > 0 && currentIndex >= cards.length;
    const isEmpty = !isLoading && cards.length === 0;

    // Reset timer on card change
    useEffect(() => {
        startTimeRef.current = Date.now();
    }, [currentIndex]);

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    const handleSubmit = (rating: number) => {
        if (!currentCard) return;

        const responseTime = Date.now() - startTimeRef.current;

        // Submit to backend
        reviewMutation.mutate({
            cardId: currentCard.cardId,
            rating,
            responseTime
        });

        // Update stats (Ratings: 1=Again, 2=Hard, 3=Good, 4=Easy)
        if (rating === 1) {
            setStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
        } else {
            setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
        }

        setIsFlipped(false);
        setCurrentIndex(prev => prev + 1);
    };

    return {
        cards,
        currentCard,
        currentIndex,
        totalDue: cards.length,
        isFlipped,
        isComplete,
        isEmpty,
        isLoading,
        error,
        handleFlip,
        handleSubmit,
        stats
    };
}
