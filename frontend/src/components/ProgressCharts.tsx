import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studyApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame, Calendar, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, BookOpen, Clock } from 'lucide-react';

interface DailyStat {
    date: string;
    dayName: string;
    reviews: number;
    correct: number;
    accuracy: number;
}

interface ProgressData {
    streak: number;
    overallAccuracy: number;
    totalReviews: number;
    bestDay: string;
    dailyStats: DailyStat[];
}

interface TodayStats {
    dueToday: number;
    reviewsToday: number;
    totalCards: number;
    nextDueTime?: string; // ISO timestamp of next due card
}

interface ProgressChartsProps {
    todayStats?: TodayStats;
}

interface HeatmapDay {
    date: string;
    reviews: number;
    dayOfWeek: number;
    week: number;
    monthKey: string;
    monthLabel: string;
}

function generateHeatmapData(dailyStats: DailyStat[] = []) {
    const months = 9;
    const today = new Date();
    const data: HeatmapDay[] = [];

    const reviewMap = new Map<string, number>();
    dailyStats.forEach((stat) => {
        reviewMap.set(stat.date, stat.reviews);
    });

    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const totalDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    for (let i = 0; i < totalDays; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();
        const weekIndex = Math.floor(i / 7);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

        data.push({
            date: dateStr,
            reviews: reviewMap.get(dateStr) || 0,
            dayOfWeek,
            week: weekIndex,
            monthKey,
            monthLabel,
        });
    }

    return data;
}

export default function ProgressCharts({ todayStats }: ProgressChartsProps) {
    const { data, isLoading } = useQuery<ProgressData>({
        queryKey: ['progress-stats'],
        queryFn: async () => {
            const response = await studyApi.getProgress();
            return response.data;
        },
    });

    const heatmapData = useMemo(() => generateHeatmapData(data?.dailyStats), [data?.dailyStats]);
    const maxReviews = useMemo(() => {
        return Math.max(...heatmapData.map((d) => d.reviews), 1);
    }, [heatmapData]);

    // Group by months, then weeks within each month
    const monthlyData = useMemo(() => {
        const monthsMap = new Map<string, { label: string; weeks: HeatmapDay[][] }>();

        heatmapData.forEach((day) => {
            if (!monthsMap.has(day.monthKey)) {
                monthsMap.set(day.monthKey, { label: day.monthLabel, weeks: [] });
            }
            const monthData = monthsMap.get(day.monthKey)!;
            const weekInMonth = monthData.weeks.length > 0
                ? (day.dayOfWeek === 0 && monthData.weeks[monthData.weeks.length - 1].length > 0
                    ? monthData.weeks.length
                    : monthData.weeks.length - 1)
                : 0;

            if (!monthData.weeks[weekInMonth]) {
                monthData.weeks[weekInMonth] = [];
            }
            monthData.weeks[weekInMonth][day.dayOfWeek] = day;
        });

        return Array.from(monthsMap.values());
    }, [heatmapData]);

    // Countdown timer for next due card
    const [countdown, setCountdown] = useState<string>('--:--:--');

    useEffect(() => {
        // If there are cards due now, show "Now!"
        if ((todayStats?.dueToday || 0) > 0) {
            setCountdown('Now!');
            return;
        }

        // If no next due time, show "No reviews due"
        if (!todayStats?.nextDueTime) {
            setCountdown('No reviews due');
            return;
        }

        const updateCountdown = () => {
            const now = new Date().getTime();
            const dueTime = new Date(todayStats.nextDueTime!).getTime();
            const diff = dueTime - now;

            if (diff <= 0) {
                setCountdown('Now!');
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            if (hours > 24) {
                const days = Math.floor(hours / 24);
                setCountdown(`${days}d ${hours % 24}h`);
            } else if (hours > 0) {
                setCountdown(`${hours}h ${minutes}m`);
            } else {
                setCountdown(`${minutes}m ${seconds}s`);
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [todayStats?.nextDueTime, todayStats?.dueToday]);

    if (isLoading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i} className="h-20 bg-slate-800/50" />
                    ))}
                </div>
                <Card className="h-40 bg-slate-800/50" />
            </div>
        );
    }

    const stats = [
        { title: 'Streak', value: data?.streak || 0, suffix: 'days', icon: Flame, color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
        { title: 'Cards Due', value: todayStats?.dueToday || 0, suffix: '', icon: AlertCircle, color: 'text-red-400', bgColor: 'bg-red-500/20' },
        { title: 'Reviews Done', value: todayStats?.reviewsToday || 0, suffix: '', icon: CheckCircle, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
        { title: 'Total Cards', value: todayStats?.totalCards || 0, suffix: '', icon: BookOpen, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    ];

    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div className="space-y-4">
            {/* Weekly Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.title} className="overflow-hidden">
                            <CardContent className="p-3">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${stat.bgColor}`}>
                                        <Icon className={`size-4 ${stat.color}`} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-400">{stat.title}</div>
                                        <div className="text-base font-bold text-slate-100">
                                            {stat.value}
                                            {stat.suffix && <span className="text-[10px] ml-1 text-slate-400">{stat.suffix}</span>}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Heatmap + Time Due - 3:1 grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Activity Heatmap - 3 columns */}
                <Card className="lg:col-span-3 overflow-hidden">

                    <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-emerald-500/20">
                                <Calendar className="size-4 text-emerald-400" />
                            </div>
                            <span>Study Activity</span>
                            <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
                                <span>Less</span>
                                <div className="flex gap-[2px]">
                                    <div className="w-[10px] h-[10px] rounded-[2px] bg-slate-700/60" />
                                    <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-900/70" />
                                    <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-600/80" />
                                    <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-400" />
                                </div>
                                <span>More</span>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                        <div className="flex items-center justify-center gap-2">
                            {/* Left Arrow */}
                            <button
                                onClick={() => {
                                    const container = document.getElementById('heatmap-container');
                                    if (container) container.scrollBy({ left: -150, behavior: 'smooth' });
                                }}
                                className="p-1 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                            >
                                <ChevronLeft className="size-4" />
                            </button>

                            {/* Day labels - All 7 days */}
                            <div className="flex flex-col gap-[2px] pr-1 text-[10px] text-slate-500 shrink-0">
                                {dayLabels.map((day, i) => (
                                    <div key={i} className="h-[11px] flex items-center justify-end">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Heatmap grid - grouped by months with gaps */}
                            <div
                                id="heatmap-container"
                                className="flex-1 overflow-x-auto scrollbar-hide"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                <div className="flex gap-3">
                                    {monthlyData.map((month, monthIndex) => (
                                        <div key={monthIndex} className="flex flex-col">
                                            {/* Month weeks */}
                                            <div className="flex gap-[2px]">
                                                {month.weeks.map((week, weekIndex) => (
                                                    <div key={weekIndex} className="flex flex-col gap-[2px]">
                                                        {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
                                                            const day = week[dayOfWeek];
                                                            if (!day) {
                                                                return <div key={dayOfWeek} className="w-[11px] h-[11px]" />;
                                                            }

                                                            let level = 0;
                                                            if (day.reviews > 0) {
                                                                const ratio = day.reviews / maxReviews;
                                                                if (ratio >= 0.75) level = 3;
                                                                else if (ratio >= 0.4) level = 2;
                                                                else level = 1;
                                                            }

                                                            const levelStyles = [
                                                                'bg-slate-700/60',
                                                                'bg-emerald-900/70',
                                                                'bg-emerald-600/80',
                                                                'bg-emerald-400',
                                                            ];

                                                            const dateObj = new Date(day.date);
                                                            const formattedDate = dateObj.toLocaleDateString('th-TH', {
                                                                weekday: 'short',
                                                                day: 'numeric',
                                                                month: 'short',
                                                            });

                                                            return (
                                                                <div
                                                                    key={day.date}
                                                                    className={`w-[11px] h-[11px] rounded-[2px] cursor-pointer transition-all hover:ring-1 hover:ring-white/40 ${levelStyles[level]}`}
                                                                    title={`${formattedDate}: ${day.reviews} reviews`}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Month label */}
                                            <div className="text-[10px] text-slate-500 mt-1">
                                                {month.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Arrow */}
                            <button
                                onClick={() => {
                                    const container = document.getElementById('heatmap-container');
                                    if (container) container.scrollBy({ left: 150, behavior: 'smooth' });
                                }}
                                className="p-1 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                            >
                                <ChevronRight className="size-4" />
                            </button>
                        </div>
                    </CardContent>
                </Card>

                {/* Time Due Card - 1 column */}
                <Card className="overflow-hidden flex flex-col">
                    <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-purple-500/20">
                                <Clock className="size-4 text-purple-400" />
                            </div>
                            <span>Next Review</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 flex-1 flex flex-col items-center justify-center">
                        <div className="text-center">
                            <div className={`text-3xl font-bold ${countdown === 'Now!'
                                ? 'text-emerald-400 animate-pulse'
                                : countdown === 'No reviews due'
                                    ? 'text-slate-500 text-lg'
                                    : 'text-purple-400'
                                }`}>
                                {countdown}
                            </div>
                            <div className="text-xs text-slate-500 mt-2">
                                {countdown === 'Now!'
                                    ? 'Cards ready to review!'
                                    : countdown === 'No reviews due'
                                        ? 'All caught up!'
                                        : 'Until next card due'}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
