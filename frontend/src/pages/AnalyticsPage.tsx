import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { studyApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertTriangle, Target, Clock, TrendingUp, BarChart3 } from 'lucide-react';
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';

// ============================================
// TYPES
// ============================================

interface WeakWord {
    id: number;
    word: string;
    meaning: string;
    stability: number;
    failRate: number;
    totalReviews: number;
}

interface ModePerformance {
    mode: string;
    modeKey: string;
    accuracy: number;
    totalReviews: number;
    fullMark: number;
}

interface HourlyPerformance {
    hour: number;
    label: string;
    accuracy: number;
    reviews: number;
}

interface AnalyticsData {
    weakWords: WeakWord[];
    modePerformance: ModePerformance[];
    hourlyPerformance: HourlyPerformance[];
    peakHour: HourlyPerformance | null;
    summary: {
        totalReviews: number;
        overallAccuracy: number;
        strongestMode: ModePerformance | null;
        weakestMode: ModePerformance | null;
    };
}

// ============================================
// STABILITY BAR COMPONENT
// ============================================

function StabilityBar({ stability }: { stability: number }) {
    const getColor = (value: number) => {
        if (value < 25) return 'bg-red-500';
        if (value < 50) return 'bg-orange-500';
        if (value < 75) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={`h-full ${getColor(stability)} transition-all duration-300`}
                    style={{ width: `${stability}%` }}
                />
            </div>
            <span className="text-xs text-slate-400 w-8 text-right">{stability}%</span>
        </div>
    );
}

// ============================================
// WEAK WORDS WIDGET
// ============================================

function WeakWordsWidget({ data }: { data: WeakWord[] }) {
    const navigate = useNavigate();

    if (data.length === 0) {
        return (
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 h-full">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-red-500/20">
                        <AlertTriangle className="size-5 text-red-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-100">Weak Words</h3>
                        <p className="text-xs text-slate-400">Words you struggle with most</p>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <BarChart3 className="size-12 mb-3 opacity-30" />
                    <p className="text-sm text-center">ยังไม่มีข้อมูลเพียงพอ</p>
                    <p className="text-xs text-slate-500">ทบทวนคำศัพท์เพิ่มเติมเพื่อดูผลการวิเคราะห์</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 h-full">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-red-500/20">
                    <AlertTriangle className="size-5 text-red-400" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-100">Weak Words</h3>
                    <p className="text-xs text-slate-400">Words you struggle with most</p>
                </div>
            </div>

            <div className="space-y-3">
                {data.map((word, index) => (
                    <div
                        key={word.id}
                        className="group p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                    >
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-500">#{index + 1}</span>
                                <span className="font-medium text-slate-100">{word.word}</span>
                            </div>
                            <span className="text-xs text-red-400 font-medium">
                                {word.failRate}% fail
                            </span>
                        </div>
                        <p className="text-sm text-slate-400 mb-2 line-clamp-1">{word.meaning}</p>
                        <StabilityBar stability={word.stability} />
                    </div>
                ))}
            </div>

            <button
                onClick={() => navigate('/study/multi')}
                className="w-full mt-4 py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-medium text-sm transition-all hover:shadow-lg hover:shadow-red-500/20 active:scale-[0.98]"
            >
                🎯 Practice These Words
            </button>
        </div>
    );
}

// ============================================
// MODE PERFORMANCE WIDGET
// ============================================

function ModePerformanceWidget({ data, summary }: { data: ModePerformance[]; summary: AnalyticsData['summary'] }) {
    if (data.length === 0) {
        return (
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 h-full">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                        <Target className="size-5 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-100">Mode Performance</h3>
                        <p className="text-xs text-slate-400">Your accuracy across study modes</p>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Target className="size-12 mb-3 opacity-30" />
                    <p className="text-sm text-center">ยังไม่มีข้อมูล</p>
                    <p className="text-xs text-slate-500">ลองใช้โหมดการเรียนที่แตกต่างกัน</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 h-full">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-purple-500/20">
                    <Target className="size-5 text-purple-400" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-100">Mode Performance</h3>
                    <p className="text-xs text-slate-400">Your accuracy across study modes</p>
                </div>
            </div>

            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                        <PolarGrid stroke="#475569" strokeOpacity={0.5} />
                        <PolarAngleAxis
                            dataKey="mode"
                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                            tickLine={false}
                        />
                        <PolarRadiusAxis
                            angle={90}
                            domain={[0, 100]}
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            tickCount={5}
                            axisLine={false}
                        />
                        <Radar
                            name="Accuracy"
                            dataKey="accuracy"
                            stroke="#a855f7"
                            fill="#a855f7"
                            fillOpacity={0.3}
                            strokeWidth={2}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>

            {summary.strongestMode && summary.weakestMode && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-slate-300">Best:</span>
                        <span className="text-green-400 font-medium truncate">
                            {summary.strongestMode.mode} ({summary.strongestMode.accuracy}%)
                        </span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-slate-300">Needs work:</span>
                        <span className="text-red-400 font-medium truncate">
                            {summary.weakestMode.mode} ({summary.weakestMode.accuracy}%)
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================
// BEST TIME WIDGET
// ============================================

function BestTimeWidget({ data, peakHour }: { data: HourlyPerformance[]; peakHour: HourlyPerformance | null }) {
    if (data.length === 0) {
        return (
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 h-full">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-cyan-500/20">
                        <Clock className="size-5 text-cyan-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-100">Best Time to Study</h3>
                        <p className="text-xs text-slate-400">When you perform at your peak</p>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Clock className="size-12 mb-3 opacity-30" />
                    <p className="text-sm text-center">ยังไม่มีข้อมูล</p>
                    <p className="text-xs text-slate-500">เรียนในช่วงเวลาต่างๆ เพื่อดูผล</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 h-full">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                    <Clock className="size-5 text-cyan-400" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-100">Best Time to Study</h3>
                    <p className="text-xs text-slate-400">When you perform at your peak</p>
                </div>
            </div>

            <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis
                            dataKey="label"
                            tick={{ fill: '#64748b', fontSize: 9 }}
                            tickLine={false}
                            axisLine={{ stroke: '#475569' }}
                            interval={data.length > 12 ? 2 : 1}
                        />
                        <YAxis
                            domain={[0, 100]}
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1e293b',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                            }}
                            labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                            itemStyle={{ color: '#94a3b8' }}
                            formatter={(value) => [`${value ?? 0}%`, 'Accuracy']}
                        />
                        <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                            {data.map((entry) => (
                                <Cell
                                    key={entry.hour}
                                    fill={peakHour && entry.hour === peakHour.hour ? '#22d3ee' : '#475569'}
                                    fillOpacity={peakHour && entry.hour === peakHour.hour ? 1 : 0.7}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {peakHour && (
                <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="size-4 text-cyan-400" />
                        <span className="text-sm text-slate-300">
                            Your peak time is <span className="font-bold text-cyan-400">{peakHour.label}</span> with{' '}
                            <span className="font-bold text-cyan-400">{peakHour.accuracy}%</span> accuracy
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================
// MAIN ANALYTICS PAGE
// ============================================

export default function AnalyticsPage() {
    const navigate = useNavigate();

    const { data, isLoading, error } = useQuery<AnalyticsData>({
        queryKey: ['analytics'],
        queryFn: async () => {
            const response = await studyApi.getAnalytics();
            return response.data;
        },
    });

    if (isLoading) {
        return (
            <div className="min-h-screen min-h-dvh w-full bg-slate-900 flex items-center justify-center">
                <Loader2 className="size-8 text-primary animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen min-h-dvh w-full bg-slate-900 flex flex-col items-center justify-center text-slate-400">
                <AlertTriangle className="size-12 mb-4" />
                <p>Failed to load analytics data</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
                    Go Back
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen min-h-dvh w-full bg-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur">
                <div className="max-w-6xl mx-auto flex h-14 items-center justify-between px-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                        <ArrowLeft className="size-4 mr-1" />
                        Back
                    </Button>
                    <h1 className="font-semibold text-slate-100">📊 Learning Analytics</h1>
                    <div className="w-16" /> {/* Spacer */}
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-primary">{data.summary.totalReviews}</div>
                        <div className="text-xs text-slate-400">Total Reviews</div>
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-green-400">{data.summary.overallAccuracy}%</div>
                        <div className="text-xs text-slate-400">Overall Accuracy</div>
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-purple-400">{data.modePerformance.length}</div>
                        <div className="text-xs text-slate-400">Modes Used</div>
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-cyan-400">{data.peakHour?.label || '-'}</div>
                        <div className="text-xs text-slate-400">Peak Study Time</div>
                    </div>
                </div>

                {/* Main Widgets Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <WeakWordsWidget data={data.weakWords} />
                    <ModePerformanceWidget data={data.modePerformance} summary={data.summary} />
                    <BestTimeWidget data={data.hourlyPerformance} peakHour={data.peakHour} />
                </div>
            </main>
        </div>
    );
}
