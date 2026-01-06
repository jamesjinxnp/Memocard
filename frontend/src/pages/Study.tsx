import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { studyApi, vocabularyApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, PartyPopper, Loader2 } from 'lucide-react';
import {
    ReadingMode,
    TypingMode,
    ListeningMode,
    MultipleChoiceMode,
    ClozeMode,
    SpellingBeeMode,
    AudioChoiceMode,
} from '@/components/study-modes';

type StudyModeType = 'reading' | 'typing' | 'listening' | 'multiple_choice' | 'cloze' | 'spelling_bee' | 'audio_choice';

export default function Study() {
    const { mode } = useParams<{ mode: StudyModeType }>();
    const navigate = useNavigate();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [completed, setCompleted] = useState(false);
    const [distractors, setDistractors] = useState<any[]>([]);

    // Fetch due cards
    const { data: sessionData, isLoading, refetch } = useQuery({
        queryKey: ['study-session', mode],
        queryFn: async () => {
            const response = await studyApi.startSession(mode!, 20);
            setSessionId(response.data.sessionId);
            return response.data;
        },
        enabled: !!mode,
    });

    // Fetch distractors for multiple choice
    useEffect(() => {
        const fetchDistractors = async () => {
            if ((mode === 'multiple_choice' || mode === 'audio_choice') && sessionData?.cards?.length > 0) {
                const currentCard = sessionData.cards[currentIndex];
                if (currentCard) {
                    const response = await vocabularyApi.getRandom(3, undefined, [currentCard.vocabulary.id]);
                    setDistractors(response.data.items || []);
                }
            }
        };
        fetchDistractors();
    }, [mode, currentIndex, sessionData]);

    // Submit review mutation
    const reviewMutation = useMutation({
        mutationFn: async ({ cardId, rating }: { cardId: string; rating: number }) => {
            return studyApi.submitReview({
                cardId,
                rating,
                studyMode: mode!,
            });
        },
        onSuccess: () => {
            if (sessionData && currentIndex < sessionData.cards.length - 1) {
                setCurrentIndex((prev) => prev + 1);
            } else {
                setCompleted(true);
                if (sessionId) {
                    studyApi.completeSession(sessionId);
                }
            }
        },
    });

    const handleRate = (rating: number) => {
        const currentCard = sessionData?.cards[currentIndex];
        if (currentCard) {
            reviewMutation.mutate({ cardId: currentCard.id, rating });
        }
    };

    const modeNames: Record<string, string> = {
        reading: 'Reading Mode',
        typing: 'Typing Mode',
        listening: 'Listening Mode',
        multiple_choice: 'Multiple Choice',
        cloze: 'Context Cloze',
        spelling_bee: 'Spelling Bee',
        audio_choice: 'Audio Choice',
    };

    if (isLoading) {
        return (
            <div className="min-h-screen min-h-dvh w-full flex items-center justify-center bg-slate-900">
                <Loader2 className="size-8 text-primary animate-spin" />
            </div>
        );
    }

    if (!sessionData?.cards?.length) {
        return (
            <div className="min-h-screen min-h-dvh w-full flex flex-col items-center justify-center gap-4 p-6 bg-slate-900 text-center">
                <PartyPopper className="size-16 text-amber-400" />
                <h2 className="text-2xl font-bold text-slate-100">No cards due!</h2>
                <p className="text-slate-400">Great job! You've reviewed all your cards for now.</p>
                <Button size="lg" onClick={() => navigate('/')}>
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    if (completed) {
        return (
            <div className="min-h-screen min-h-dvh w-full flex items-center justify-center p-6 bg-slate-900">
                <Card className="max-w-md w-full text-center">
                    <CardContent className="p-8 space-y-4">
                        <PartyPopper className="size-16 text-amber-400 mx-auto" />
                        <h2 className="text-2xl font-bold text-slate-100">Session Complete!</h2>
                        <p className="text-slate-400">You reviewed {sessionData.cards.length} cards</p>
                        <div className="flex gap-3 justify-center pt-4">
                            <Button onClick={() => { setCurrentIndex(0); setCompleted(false); refetch(); }}>
                                Study More
                            </Button>
                            <Button variant="outline" onClick={() => navigate('/')}>
                                Back to Dashboard
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const currentCard = sessionData.cards[currentIndex];
    const vocabulary = currentCard.vocabulary;
    const progress = ((currentIndex + 1) / sessionData.cards.length) * 100;

    const renderMode = () => {
        switch (mode) {
            case 'reading':
                return <ReadingMode vocabulary={vocabulary} onRate={handleRate} />;
            case 'typing':
                return <TypingMode vocabulary={vocabulary} onRate={handleRate} />;
            case 'listening':
                return <ListeningMode vocabulary={vocabulary} onRate={handleRate} />;
            case 'multiple_choice':
                return <MultipleChoiceMode vocabulary={vocabulary} distractors={distractors} onRate={handleRate} />;
            case 'cloze':
                return <ClozeMode vocabulary={vocabulary} onRate={handleRate} />;
            case 'spelling_bee':
                return <SpellingBeeMode vocabulary={vocabulary} onRate={handleRate} />;
            case 'audio_choice':
                return <AudioChoiceMode vocabulary={vocabulary} distractors={distractors} onRate={handleRate} />;
            default:
                return <ReadingMode vocabulary={vocabulary} onRate={handleRate} />;
        }
    };

    return (
        <div className="min-h-screen min-h-dvh w-full flex flex-col bg-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur">
                <div className="max-w-6xl mx-auto flex h-14 items-center justify-between px-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                        <ArrowLeft className="size-4" />
                        Back
                    </Button>
                    <h1 className="font-semibold text-slate-100">{modeNames[mode!] || 'Study'}</h1>
                    <span className="text-sm text-slate-400">
                        {currentIndex + 1} / {sessionData.cards.length}
                    </span>
                </div>
            </header>

            {/* Progress Bar */}
            <div className="h-1 bg-slate-800">
                <div
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Study Mode Content */}
            <main className="flex-1 flex items-center justify-center p-4 md:p-6">
                {renderMode()}
            </main>
        </div>
    );
}
