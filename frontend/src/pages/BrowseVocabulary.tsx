import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vocabularyApi, studyApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Search, Volume2, Check, Loader2, BookOpen } from 'lucide-react';
import { speak } from '@/services/audio';

interface Vocabulary {
    id: number;
    word: string;
    defTh: string | null;
    defEn: string | null;
    type: string | null;
    ipaUs: string | null;
    ipaUk: string | null;
    cefr: string | null;
    example: string | null;
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const CEFR_COLORS: Record<string, string> = {
    A1: 'bg-emerald-500',
    A2: 'bg-green-500',
    B1: 'bg-yellow-500',
    B2: 'bg-orange-500',
    C1: 'bg-red-500',
};

const DECK_FILTERS = [
    { id: null, name: 'All' },
    { id: 'oxford3000', name: 'Oxford 3000' },
    { id: 'oxford5000', name: 'Oxford 5000' },
    { id: 'Toeic', name: 'TOEIC' },
];

export default function BrowseVocabulary() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCefr, setSelectedCefr] = useState<string | null>(null);
    const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
    const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

    // Fetch vocabulary
    const { data, isLoading } = useQuery({
        queryKey: ['vocabulary', selectedCefr, selectedDeck, searchQuery],
        queryFn: async () => {
            if (searchQuery.trim()) {
                const response = await vocabularyApi.search(searchQuery);
                return response.data;
            }
            const response = await vocabularyApi.getAll(1, 50, selectedCefr || undefined, selectedDeck || undefined);
            return response.data;
        },
    });

    // Add card mutation
    const addCardMutation = useMutation({
        mutationFn: (vocabularyId: number) => studyApi.learnCard(vocabularyId),
        onSuccess: (_, vocabularyId) => {
            setAddedIds(prev => new Set(prev).add(vocabularyId));
            queryClient.invalidateQueries({ queryKey: ['study-stats'] });
        },
    });

    const handleAddCard = (vocabId: number) => {
        addCardMutation.mutate(vocabId);
    };

    const playAudio = (word: string) => {
        speak(word);
    };

    const vocabulary: Vocabulary[] = data?.items || data?.vocabulary || [];

    return (
        <div className="min-h-screen min-h-dvh w-full bg-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur">
                <div className="max-w-6xl mx-auto flex h-14 items-center justify-between px-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                        <ArrowLeft className="size-4" />
                        Back
                    </Button>
                    <h1 className="font-semibold text-slate-100">Browse Vocabulary</h1>
                    <div className="w-20" />
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Search & Filter */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                        <Input
                            placeholder="Search vocabulary..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Deck Filter Tabs */}
                <div className="flex gap-2 flex-wrap">
                    <span className="text-sm text-slate-400 mr-2 self-center">Deck:</span>
                    {DECK_FILTERS.map((deck) => (
                        <Button
                            key={deck.id || 'all'}
                            variant={selectedDeck === deck.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedDeck(deck.id)}
                        >
                            {deck.name}
                        </Button>
                    ))}
                </div>

                {/* CEFR Level Filter */}
                <div className="flex gap-2 flex-wrap">
                    <span className="text-sm text-slate-400 mr-2 self-center">CEFR:</span>
                    <Button
                        variant={selectedCefr === null ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedCefr(null)}
                    >
                        All
                    </Button>
                    {CEFR_LEVELS.map((level) => (
                        <Button
                            key={level}
                            variant={selectedCefr === level ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCefr(level)}
                        >
                            {level}
                        </Button>
                    ))}
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="size-8 text-primary animate-spin" />
                    </div>
                )}

                {/* Vocabulary Grid */}
                {!isLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {vocabulary.map((vocab) => {
                            const isAdded = addedIds.has(vocab.id);
                            const isAdding = addCardMutation.isPending && addCardMutation.variables === vocab.id;

                            return (
                                <Card key={vocab.id} className="hover:border-primary/50 transition-colors">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                {/* Word & CEFR */}
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-lg font-bold text-slate-100 truncate">
                                                        {vocab.word}
                                                    </h3>
                                                    {vocab.cefr && (
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${CEFR_COLORS[vocab.cefr] || 'bg-slate-500'}`}>
                                                            {vocab.cefr}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Type & IPA */}
                                                <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                                                    {vocab.type && <span className="italic">{vocab.type}</span>}
                                                    {vocab.ipaUs && <span>/{vocab.ipaUs}/</span>}
                                                </div>

                                                {/* Definition */}
                                                <p className="text-sm text-slate-300 line-clamp-2">
                                                    {vocab.defTh || vocab.defEn || 'No definition'}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-col gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => playAudio(vocab.word)}
                                                    className="size-8"
                                                >
                                                    <Volume2 className="size-4" />
                                                </Button>

                                                <Button
                                                    variant={isAdded ? 'success' : 'default'}
                                                    size="icon"
                                                    onClick={() => handleAddCard(vocab.id)}
                                                    disabled={isAdded || isAdding}
                                                    className="size-8"
                                                >
                                                    {isAdding ? (
                                                        <Loader2 className="size-4 animate-spin" />
                                                    ) : isAdded ? (
                                                        <Check className="size-4" />
                                                    ) : (
                                                        <Plus className="size-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && vocabulary.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <BookOpen className="size-16 text-slate-600 mb-4" />
                        <h3 className="text-xl font-semibold text-slate-300 mb-2">No vocabulary found</h3>
                        <p className="text-slate-400">Try a different search or filter</p>
                    </div>
                )}

                {/* Added Count */}
                {addedIds.size > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                        <Card className="bg-primary/90 border-primary shadow-xl">
                            <CardContent className="px-6 py-3 flex items-center gap-3">
                                <Check className="size-5 text-white" />
                                <span className="text-white font-medium">
                                    {addedIds.size} card{addedIds.size > 1 ? 's' : ''} added
                                </span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => navigate('/')}
                                >
                                    Start Learning
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </main>
        </div>
    );
}
