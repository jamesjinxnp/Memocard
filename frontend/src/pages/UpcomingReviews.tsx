import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { studyApi } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, ChevronLeft, ChevronRight, BookOpen, Timer } from 'lucide-react';

interface UpcomingCard {
    id: string;
    vocabulary: {
        id: number;
        word: string;
        defTh: string | null;
        defEn: string | null;
        type: string | null;
    };
    due: string;
    state: number;
}

interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const STATE_LABELS: Record<number, { label: string; color: string }> = {
    1: { label: 'Learning', color: 'text-amber-400 bg-amber-500/20' },
    2: { label: 'Review', color: 'text-emerald-400 bg-emerald-500/20' },
    3: { label: 'Relearning', color: 'text-red-400 bg-red-500/20' },
};

function formatCountdown(dueDate: string, now: number): { text: string; isDue: boolean } {
    const dueTime = new Date(dueDate).getTime();
    const diff = dueTime - now;

    if (diff <= 0) {
        return { text: 'Now!', isDue: true };
    }

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return { text: `${days}d ${hours % 24}h`, isDue: false };
    }
    if (hours > 0) {
        return { text: `${hours}h ${minutes % 60}m`, isDue: false };
    }
    if (minutes > 0) {
        return { text: `${minutes}m ${seconds % 60}s`, isDue: false };
    }
    return { text: `${seconds}s`, isDue: false };
}

export default function UpcomingReviews() {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [now, setNow] = useState(Date.now());

    // Shared timer for all countdown updates (1 per page, not 1 per card)
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['upcoming-reviews', page, pageSize],
        queryFn: async () => {
            const response = await studyApi.getUpcomingReviews(page, pageSize);
            return response.data as { cards: UpcomingCard[]; pagination: PaginationInfo };
        },
        placeholderData: (prev) => prev, // Keep previous data while loading next page
    });

    const cards = data?.cards || [];
    const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };

    const handlePageSizeChange = useCallback((newSize: number) => {
        setPageSize(newSize);
        setPage(1); // Reset to first page when changing page size
    }, []);

    return (
        <div className="min-h-screen min-h-dvh w-full bg-deep">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-[var(--color-border-default)] bg-[var(--color-bg-deep)]/95 backdrop-blur-md">
                <div className="max-w-4xl mx-auto flex h-14 items-center gap-3 px-4 md:px-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/')}
                        className="text-[var(--color-text-secondary)] hover:text-primary hover:bg-primary/10 shrink-0"
                    >
                        <ArrowLeft className="size-5" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-purple-500/20">
                            <Clock className="size-4 text-purple-400" />
                        </div>
                        <h1 className="text-lg font-semibold font-display text-[var(--color-text-primary)]">
                            Upcoming Reviews
                        </h1>
                    </div>
                    <div className="ml-auto text-sm text-[var(--color-text-secondary)]">
                        {pagination.total} cards
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-4">
                {/* Controls Bar */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                        <span>Show</span>
                        <select
                            value={pageSize}
                            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                            className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                        >
                            {PAGE_SIZE_OPTIONS.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                        <span>per page</span>
                    </div>

                    {/* Pagination Info */}
                    {pagination.totalPages > 1 && (
                        <span className="text-sm text-[var(--color-text-muted)]">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                    )}
                </div>

                {/* Loading Skeleton */}
                {isLoading && (
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <Card key={i} className="animate-pulse">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-2">
                                            <div className="h-5 w-32 bg-[var(--color-bg-elevated)] rounded" />
                                            <div className="h-4 w-48 bg-[var(--color-bg-elevated)] rounded" />
                                        </div>
                                        <div className="h-8 w-20 bg-[var(--color-bg-elevated)] rounded" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && cards.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="p-4 rounded-2xl bg-purple-500/10 mb-4">
                            <BookOpen className="size-10 text-purple-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                            No upcoming reviews
                        </h2>
                        <p className="text-sm text-[var(--color-text-secondary)] max-w-sm">
                            Start learning vocabulary to see your upcoming reviews here.
                        </p>
                        <Button
                            onClick={() => navigate('/')}
                            className="mt-6 bg-gradient-to-r from-primary to-secondary text-white"
                        >
                            Go to Dashboard
                        </Button>
                    </div>
                )}

                {/* Card List */}
                {!isLoading && cards.length > 0 && (
                    <div className={`space-y-2 transition-opacity duration-200 ${isFetching ? 'opacity-60' : 'opacity-100'}`}>
                        {cards.map((card) => {
                            const { text: countdownText, isDue } = formatCountdown(card.due, now);
                            const stateInfo = STATE_LABELS[card.state] || { label: 'Unknown', color: 'text-gray-400 bg-gray-500/20' };

                            return (
                                <Card
                                    key={card.id}
                                    className="overflow-hidden hover:border-primary/30 transition-colors"
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            {/* Word Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-[var(--color-text-primary)] truncate">
                                                        {card.vocabulary.word}
                                                    </span>
                                                    {card.vocabulary.type && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] shrink-0">
                                                            {card.vocabulary.type}
                                                        </span>
                                                    )}
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${stateInfo.color}`}>
                                                        {stateInfo.label}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-[var(--color-text-secondary)] truncate">
                                                    {card.vocabulary.defTh || card.vocabulary.defEn || '—'}
                                                </p>
                                            </div>

                                            {/* Countdown */}
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Timer className={`size-4 ${isDue ? 'text-emerald-400' : 'text-purple-400'}`} />
                                                <span className={`text-sm font-mono font-semibold ${isDue
                                                        ? 'text-emerald-400 animate-pulse'
                                                        : 'text-purple-400'
                                                    }`}>
                                                    {countdownText}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1 || isFetching}
                            className="gap-1 border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-primary hover:border-primary/30 disabled:opacity-40"
                        >
                            <ChevronLeft className="size-4" />
                            Previous
                        </Button>

                        <div className="flex items-center gap-1">
                            {/* Show page numbers around current page */}
                            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                                .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
                                .map((p, idx, arr) => (
                                    <span key={p} className="flex items-center">
                                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                                            <span className="text-[var(--color-text-muted)] px-1">…</span>
                                        )}
                                        <button
                                            onClick={() => setPage(p)}
                                            disabled={isFetching}
                                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === page
                                                    ? 'bg-primary text-white'
                                                    : 'text-[var(--color-text-secondary)] hover:bg-primary/10 hover:text-primary'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    </span>
                                ))}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                            disabled={page >= pagination.totalPages || isFetching}
                            className="gap-1 border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-primary hover:border-primary/30 disabled:opacity-40"
                        >
                            Next
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}
