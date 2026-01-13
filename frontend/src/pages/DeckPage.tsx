import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vocabularyApi, studyApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Loader2, Volume2, Search, ChevronDown, Settings } from 'lucide-react';
import { speak } from '@/services/audio';

interface VocabItem {
    id: number;
    word: string;
    defTh: string | null;
    defEn: string | null;
    type: string | null;
    cefr: string | null;
    tag: string | null;
}

interface LevelCount {
    level: string;
    count: number;
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const TOEIC_LEVELS = ['Basic', 'Advanced', 'Expert', 'Master'];
const WORDS_PER_PAGE = 20;

const CEFR_COLORS: Record<string, string> = {
    A1: 'bg-emerald-500',
    A2: 'bg-green-500',
    B1: 'bg-yellow-500',
    B2: 'bg-orange-500',
    C1: 'bg-red-500',
};

const TOEIC_COLORS: Record<string, string> = {
    Basic: 'bg-emerald-500',
    Advanced: 'bg-blue-500',
    Expert: 'bg-purple-500',
    Master: 'bg-red-500',
};

const DECK_INFO: Record<string, { name: string; description: string; color: string }> = {
    oxford3000: { name: 'Oxford 3000', description: 'คำศัพท์สำคัญ 3000 คำสำหรับผู้เรียน', color: 'from-emerald-500 to-teal-500' },
    oxford5000: { name: 'Oxford 5000', description: 'คำศัพท์ขยายสำหรับผู้เรียนขั้นสูง', color: 'from-blue-500 to-indigo-500' },
    Toeic: { name: 'TOEIC', description: 'คำศัพท์สำคัญสำหรับสอบ TOEIC', color: 'from-purple-500 to-pink-500' },
};

export default function DeckPage() {
    const { deckId } = useParams<{ deckId: string }>();
    const navigate = useNavigate();
    const deckInfo = DECK_INFO[deckId || ''] || { name: deckId, description: '', color: 'from-slate-500 to-slate-600' };
    const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [displayCount, setDisplayCount] = useState(WORDS_PER_PAGE);
    const [showSettings, setShowSettings] = useState(false);
    const [dailyNewCards, setDailyNewCards] = useState(() => {
        const saved = localStorage.getItem(`deck-settings-${deckId}`);
        return saved ? JSON.parse(saved).dailyNewCards || 20 : 20;
    });
    const [tempDailyCards, setTempDailyCards] = useState(dailyNewCards);
    const isToeic = deckId === 'Toeic';

    // Save settings to localStorage
    const saveDailyNewCards = (value: number) => {
        setDailyNewCards(value);
        localStorage.setItem(`deck-settings-${deckId}`, JSON.stringify({ dailyNewCards: value }));
    };

    // Fetch level counts (with caching)
    const { data: countsData, isLoading: countsLoading } = useQuery({
        queryKey: ['deck-counts', deckId],
        queryFn: async () => {
            const response = await vocabularyApi.getAll(1, 5000, undefined, deckId);
            const items: VocabItem[] = response.data?.items || [];

            // Calculate counts per level
            const levels = isToeic ? TOEIC_LEVELS : CEFR_LEVELS;
            const counts: LevelCount[] = levels.map(level => ({
                level,
                count: isToeic
                    ? items.filter(v => v.tag?.split(',').map(t => t.trim()).includes(level)).length
                    : items.filter(v => v.cefr === level).length
            })).filter(c => c.count > 0);

            return {
                totalWords: items.length,
                counts,
                items // Cache for later use
            };
        },
        enabled: !!deckId,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    // Fetch user's card states for this deck (intersection: words in deck that user has learned)
    const { data: statsData } = useQuery({
        queryKey: ['study-stats', deckId],
        queryFn: async () => {
            const response = await studyApi.getStats(deckId);
            return response.data;
        },
        enabled: !!deckId,
    });

    // Fetch queue counts for this deck
    const { data: queueData } = useQuery({
        queryKey: ['deck-queue', deckId, dailyNewCards],
        queryFn: async () => {
            const response = await studyApi.getQueue(deckId, dailyNewCards);
            return response.data;
        },
        enabled: !!deckId,
        staleTime: 30 * 1000, // Cache for 30 seconds
    });

    // Get vocabulary for expanded level (memoized from cached data)
    const allExpandedWords = useMemo(() => {
        if (!expandedLevel || !countsData?.items) return [];

        const items: VocabItem[] = countsData.items;
        if (isToeic) {
            return items.filter(v => v.tag?.split(',').map(t => t.trim()).includes(expandedLevel));
        } else {
            return items.filter(v => v.cefr === expandedLevel);
        }
    }, [expandedLevel, countsData?.items, isToeic]);

    // Filter by search query
    const filteredWords = useMemo(() => {
        if (!searchQuery.trim()) return allExpandedWords;
        const query = searchQuery.toLowerCase().trim();
        return allExpandedWords.filter(word =>
            word.word.toLowerCase().includes(query) ||
            word.defTh?.toLowerCase().includes(query) ||
            word.defEn?.toLowerCase().includes(query)
        );
    }, [allExpandedWords, searchQuery]);

    // Paginated words to display
    const displayedWords = useMemo(() => {
        return filteredWords.slice(0, displayCount);
    }, [filteredWords, displayCount]);

    const hasMoreWords = displayCount < filteredWords.length;

    const levelColors = isToeic ? TOEIC_COLORS : CEFR_COLORS;
    const levelCounts = countsData?.counts || [];
    const totalWords = countsData?.totalWords || 0;
    const learnedWords = statsData?.totalCards || 0;

    // Toggle expanded level (accordion: only one at a time)
    const toggleLevel = (level: string) => {
        if (expandedLevel === level) {
            setExpandedLevel(null);
        } else {
            setExpandedLevel(level);
            setDisplayCount(WORDS_PER_PAGE); // Reset pagination
            setSearchQuery(''); // Reset search
        }
    };

    // Load more words
    const loadMore = () => {
        setDisplayCount(prev => prev + WORDS_PER_PAGE);
    };

    // Play audio
    const playAudio = (word: string) => {
        speak(word);
    };

    if (countsLoading) {
        return (
            <div className="min-h-screen min-h-dvh w-full bg-slate-900 flex items-center justify-center">
                <Loader2 className="size-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen min-h-dvh w-full bg-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur">
                <div className="max-w-6xl mx-auto flex h-14 items-center justify-between px-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                        <ArrowLeft className="size-4" />
                        Back
                    </Button>
                    <h1 className="font-semibold text-slate-100">{deckInfo.name}</h1>
                    <div className="relative">
                        <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
                            <Settings className="size-4" />
                        </Button>
                        {/* Settings Popover */}
                        {showSettings && (
                            <>
                                {/* Invisible backdrop to close popover */}
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => {
                                        setTempDailyCards(dailyNewCards);
                                        setShowSettings(false);
                                    }}
                                />
                                {/* Popover */}
                                <div className="absolute right-0 top-full mt-2 z-50 w-80">
                                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl">
                                        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-4">
                                            <Settings className="size-4" />
                                            Deck Settings
                                        </h3>

                                        <div className="space-y-3">
                                            <div className="space-y-2">
                                                <label className="text-xs text-slate-300">คำใหม่ต่อวัน</label>
                                                <div className="flex items-start gap-3">
                                                    {/* Left Wrapper: Slider + Labels */}
                                                    <div className="flex-1 space-y-1">
                                                        <input
                                                            type="range"
                                                            min="5"
                                                            max="100"
                                                            step="5"
                                                            value={tempDailyCards}
                                                            onChange={(e) => setTempDailyCards(parseInt(e.target.value))}
                                                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                                        />
                                                        <div className="flex justify-between text-[10px] text-slate-500">
                                                            <span>5</span>
                                                            <span>25</span>
                                                            <span>50</span>
                                                            <span>75</span>
                                                            <span>100</span>
                                                        </div>
                                                    </div>
                                                    {/* Number Input (outside the left wrapper) */}
                                                    <input
                                                        type="number"
                                                        min="5"
                                                        max="100"
                                                        step="5"
                                                        value={tempDailyCards}
                                                        onChange={(e) => {
                                                            const value = parseInt(e.target.value) || 5;
                                                            const clamped = Math.min(100, Math.max(5, value));
                                                            setTempDailyCards(clamped);
                                                        }}
                                                        onBlur={(e) => {
                                                            const value = parseInt(e.target.value) || 5;
                                                            const clamped = Math.min(100, Math.max(5, value));
                                                            setTempDailyCards(clamped);
                                                        }}
                                                        className="w-14 h-8 px-2 text-center text-sm font-bold text-primary bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                </div>
                                            </div>

                                            <p className="text-[10px] text-slate-400">
                                                จำนวนคำศัพท์ใหม่ที่จะเรียนต่อวัน
                                            </p>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-2 mt-4">
                                            <button
                                                onClick={() => {
                                                    setTempDailyCards(dailyNewCards);
                                                    setShowSettings(false);
                                                }}
                                                className="flex-1 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => {
                                                    saveDailyNewCards(tempDailyCards);
                                                    setShowSettings(false);
                                                }}
                                                className="flex-1 px-3 py-1.5 text-sm bg-primary hover:bg-primary/80 text-white font-medium rounded-lg transition-colors"
                                            >
                                                💾 Save
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Deck Header */}
                <div className={`relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-r ${deckInfo.color} p-6`}>
                    <div className="relative z-10">
                        <h2 className="text-2xl font-bold text-white mb-2">{deckInfo.name}</h2>
                        <p className="text-white/80 mb-4">{deckInfo.description}</p>
                        <div className="flex items-center gap-4 text-white/90">
                            <span className="font-medium">{totalWords.toLocaleString()} คำศัพท์</span>
                            <span>•</span>
                            <span>{learnedWords} คำที่เรียนแล้ว</span>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white/80 rounded-full transition-all"
                                style={{ width: `${totalWords > 0 ? (learnedWords / totalWords) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                </div>


                {/* Session Progress UI */}
                {queueData && (
                    <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                        <h3 className="text-sm font-medium text-slate-400 mb-3">คิวที่ต้องเรียนวันนี้</h3>
                        <div className="grid grid-cols-4 gap-3">
                            {/* Relearning */}
                            <div className={`p-3 rounded-lg text-center ${(queueData.totalByState?.relearning || 0) > 0 ? 'bg-red-500/20 border border-red-500/50' : 'bg-slate-700/50'}`}>
                                <div className="text-2xl font-bold text-red-400">{queueData.totalByState?.relearning || 0}</div>
                                <div className="text-xs text-slate-400">🔴 Relearn</div>
                            </div>
                            {/* Learning */}
                            <div className={`p-3 rounded-lg text-center ${(queueData.totalByState?.learning || 0) > 0 ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-slate-700/50'}`}>
                                <div className="text-2xl font-bold text-orange-400">{queueData.totalByState?.learning || 0}</div>
                                <div className="text-xs text-slate-400">🟠 Learn</div>
                            </div>
                            {/* Review */}
                            <div className={`p-3 rounded-lg text-center ${(queueData.totalByState?.review || 0) > 0 ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-slate-700/50'}`}>
                                <div className="text-2xl font-bold text-yellow-400">{queueData.totalByState?.review || 0}</div>
                                <div className="text-xs text-slate-400">🟡 Review</div>
                            </div>
                            {/* New */}
                            <div className={`p-3 rounded-lg text-center ${(queueData.totalByState?.new || 0) > 0 ? 'bg-green-500/20 border border-green-500/50' : 'bg-slate-700/50'}`}>
                                <div className="text-2xl font-bold text-green-400">{queueData.totalByState?.new || 0}</div>
                                <div className="text-xs text-slate-400">🟢 New</div>
                            </div>
                        </div>
                        {/* Quota info */}
                        {queueData.quota && (
                            <div className="mt-3 text-xs text-slate-500 text-center">
                                คำใหม่วันนี้: {queueData.quota.used || 0}/{queueData.quota.daily || dailyNewCards}
                            </div>
                        )}
                    </div>
                )}

                {/* Start Learning Button */}
                <Button
                    size="lg"
                    className="w-full py-6 text-lg"
                    onClick={() => navigate(`/study/multi?deck=${deckId}`)}
                >
                    <BookOpen className="size-5 mr-2" />
                    Start Learning
                </Button>

                {/* Level Cards Section */}
                <section>
                    <h3 className="text-lg font-semibold text-slate-100 mb-4">คำศัพท์ตามระดับ</h3>

                    {/* Level Cards Grid - Horizontal */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
                        {levelCounts.map(({ level, count }) => {
                            const isExpanded = expandedLevel === level;
                            return (
                                <button
                                    key={level}
                                    onClick={() => toggleLevel(level)}
                                    className={`rounded-xl border py-8 px-4 text-center transition-all ${isExpanded
                                        ? 'border-primary bg-primary/10 ring-2 ring-primary/50'
                                        : 'border-slate-700/50 bg-slate-800/50 hover:border-primary/50 hover:bg-slate-700/30'
                                        }`}
                                >
                                    <div className={`inline-block px-5 py-2 rounded-full text-white text-xl font-bold mb-3 ${levelColors[level]}`}>
                                        {level}
                                    </div>
                                    <div className="text-slate-100 font-medium text-lg">{count} คำ</div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Expanded Vocabulary Cards with Search */}
                    {expandedLevel && (
                        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 mb-4">
                            {/* Header with level badge and search */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${levelColors[expandedLevel]}`}>
                                        {expandedLevel}
                                    </span>
                                    <span className="text-slate-400 text-sm">
                                        {filteredWords.length} / {allExpandedWords.length} คำ
                                    </span>
                                </div>

                                {/* Search Box */}
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="ค้นหาคำศัพท์..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setDisplayCount(WORDS_PER_PAGE); // Reset pagination on search
                                        }}
                                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                    />
                                </div>
                            </div>

                            {/* Vocabulary Cards Grid */}
                            {displayedWords.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {displayedWords.map((word) => (
                                            <div
                                                key={word.id}
                                                className="rounded-xl border border-slate-700/50 bg-slate-800/80 p-3 hover:border-primary/50 hover:bg-slate-700/50 transition-all group/card"
                                            >
                                                <div className="flex items-start justify-between gap-1">
                                                    <span className="font-medium text-slate-100 text-sm leading-tight">{word.word}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="shrink-0 size-6 opacity-50 group-hover/card:opacity-100"
                                                        onClick={(e) => { e.stopPropagation(); playAudio(word.word); }}
                                                    >
                                                        <Volume2 className="size-3" />
                                                    </Button>
                                                </div>
                                                {word.type && (
                                                    <div className="text-xs text-slate-500 italic mt-0.5">{word.type}</div>
                                                )}
                                                {word.defTh && (
                                                    <div className="text-xs text-slate-400 mt-1 line-clamp-2">{word.defTh}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Load More Button */}
                                    {hasMoreWords && (
                                        <div className="mt-4 text-center">
                                            <Button
                                                variant="outline"
                                                onClick={loadMore}
                                                className="gap-2"
                                            >
                                                <ChevronDown className="size-4" />
                                                โหลดเพิ่ม ({filteredWords.length - displayCount} คำ)
                                            </Button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-8 text-slate-400">
                                    ไม่พบคำศัพท์ที่ค้นหา
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
