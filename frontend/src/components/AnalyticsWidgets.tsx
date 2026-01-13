import { useMemo } from 'react';
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
import { AlertTriangle, Target, Clock, TrendingUp } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface WeakWord {
    id: number;
    word: string;
    meaning: string;
    stability: number; // 0-100, lower = weaker
    failRate: number; // percentage
}

interface ModePerformance {
    mode: string;
    accuracy: number;
    fullMark: 100;
}

interface HourlyPerformance {
    hour: number;
    label: string;
    accuracy: number;
    reviews: number;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_WEAK_WORDS: WeakWord[] = [
    { id: 1, word: 'ephemeral', meaning: 'ชั่วคราว, ไม่ยั่งยืน', stability: 15, failRate: 78 },
    { id: 2, word: 'ubiquitous', meaning: 'มีอยู่ทุกหนทุกแห่ง', stability: 22, failRate: 65 },
    { id: 3, word: 'pragmatic', meaning: 'เน้นประโยชน์จริง', stability: 28, failRate: 58 },
    { id: 4, word: 'ambiguous', meaning: 'กำกวม, คลุมเครือ', stability: 35, failRate: 52 },
    { id: 5, word: 'meticulous', meaning: 'พิถีพิถัน, ละเอียด', stability: 40, failRate: 45 },
];

const MOCK_MODE_PERFORMANCE: ModePerformance[] = [
    { mode: 'Reading', accuracy: 92, fullMark: 100 },
    { mode: 'Listening', accuracy: 68, fullMark: 100 },
    { mode: 'Typing', accuracy: 75, fullMark: 100 },
    { mode: 'Spelling', accuracy: 58, fullMark: 100 },
    { mode: 'Speaking', accuracy: 45, fullMark: 100 },
    { mode: 'Flashcard', accuracy: 88, fullMark: 100 },
    { mode: 'Multiple Choice', accuracy: 85, fullMark: 100 },
];

const MOCK_HOURLY_PERFORMANCE: HourlyPerformance[] = [
    { hour: 6, label: '6AM', accuracy: 72, reviews: 15 },
    { hour: 7, label: '7AM', accuracy: 78, reviews: 42 },
    { hour: 8, label: '8AM', accuracy: 85, reviews: 68 },
    { hour: 9, label: '9AM', accuracy: 91, reviews: 95 }, // Peak!
    { hour: 10, label: '10AM', accuracy: 88, reviews: 78 },
    { hour: 11, label: '11AM', accuracy: 82, reviews: 52 },
    { hour: 12, label: '12PM', accuracy: 75, reviews: 35 },
    { hour: 13, label: '1PM', accuracy: 70, reviews: 28 },
    { hour: 14, label: '2PM', accuracy: 68, reviews: 22 },
    { hour: 15, label: '3PM', accuracy: 72, reviews: 38 },
    { hour: 16, label: '4PM', accuracy: 78, reviews: 55 },
    { hour: 17, label: '5PM', accuracy: 82, reviews: 72 },
    { hour: 18, label: '6PM', accuracy: 86, reviews: 88 },
    { hour: 19, label: '7PM', accuracy: 84, reviews: 65 },
    { hour: 20, label: '8PM', accuracy: 80, reviews: 48 },
    { hour: 21, label: '9PM', accuracy: 74, reviews: 32 },
    { hour: 22, label: '10PM', accuracy: 65, reviews: 18 },
];

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
// 1. WEAK WORDS ANALYSIS WIDGET
// ============================================

function WeakWordsWidget() {
    return (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 h-full">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-red-500/20">
                    <AlertTriangle className="size-5 text-red-400" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-100">Weak Words</h3>
                    <p className="text-xs text-slate-400">Words you struggle with most</p>
                </div>
            </div>

            {/* Word List */}
            <div className="space-y-3">
                {MOCK_WEAK_WORDS.map((word, index) => (
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
                        <p className="text-sm text-slate-400 mb-2">{word.meaning}</p>
                        <StabilityBar stability={word.stability} />
                    </div>
                ))}
            </div>

            {/* Action Button */}
            <button className="w-full mt-4 py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-medium text-sm transition-all hover:shadow-lg hover:shadow-red-500/20 active:scale-[0.98]">
                🎯 Practice These Words
            </button>
        </div>
    );
}

// ============================================
// 2. MODE PERFORMANCE RADAR CHART WIDGET
// ============================================

function ModePerformanceWidget() {
    return (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 h-full">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-purple-500/20">
                    <Target className="size-5 text-purple-400" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-100">Mode Performance</h3>
                    <p className="text-xs text-slate-400">Your accuracy across study modes</p>
                </div>
            </div>

            {/* Radar Chart */}
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={MOCK_MODE_PERFORMANCE}>
                        <PolarGrid
                            stroke="#475569"
                            strokeOpacity={0.5}
                        />
                        <PolarAngleAxis
                            dataKey="mode"
                            tick={{ fill: '#94a3b8', fontSize: 11 }}
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

            {/* Legend / Summary */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-slate-300">Strongest:</span>
                    <span className="text-green-400 font-medium">Reading (92%)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-slate-300">Weakest:</span>
                    <span className="text-red-400 font-medium">Speaking (45%)</span>
                </div>
            </div>
        </div>
    );
}

// ============================================
// 3. BEST TIME TO STUDY BAR CHART WIDGET
// ============================================

function BestTimeWidget() {
    const peakHour = useMemo(() => {
        return MOCK_HOURLY_PERFORMANCE.reduce((max, curr) =>
            curr.accuracy > max.accuracy ? curr : max
        );
    }, []);

    return (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 h-full">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                    <Clock className="size-5 text-cyan-400" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-100">Best Time to Study</h3>
                    <p className="text-xs text-slate-400">When you perform at your peak</p>
                </div>
            </div>

            {/* Bar Chart */}
            <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={MOCK_HOURLY_PERFORMANCE}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#334155"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="label"
                            tick={{ fill: '#64748b', fontSize: 9 }}
                            tickLine={false}
                            axisLine={{ stroke: '#475569' }}
                            interval={2}
                        />
                        <YAxis
                            domain={[50, 100]}
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
                            {MOCK_HOURLY_PERFORMANCE.map((entry) => (
                                <Cell
                                    key={entry.hour}
                                    fill={entry.hour === peakHour.hour ? '#22d3ee' : '#475569'}
                                    fillOpacity={entry.hour === peakHour.hour ? 1 : 0.7}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Peak Time Highlight */}
            <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-cyan-400" />
                    <span className="text-sm text-slate-300">
                        Your peak time is <span className="font-bold text-cyan-400">{peakHour.label}</span> with{' '}
                        <span className="font-bold text-cyan-400">{peakHour.accuracy}%</span> accuracy
                    </span>
                </div>
            </div>
        </div>
    );
}

// ============================================
// MAIN ANALYTICS WIDGETS COMPONENT
// ============================================

export default function AnalyticsWidgets() {
    return (
        <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                📊 Learning Analytics
            </h2>

            {/* Responsive Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Widget 1: Weak Words (Takes more vertical space on mobile) */}
                <div className="lg:row-span-1">
                    <WeakWordsWidget />
                </div>

                {/* Widget 2: Mode Performance */}
                <div className="lg:row-span-1">
                    <ModePerformanceWidget />
                </div>

                {/* Widget 3: Best Time to Study */}
                <div className="lg:row-span-1">
                    <BestTimeWidget />
                </div>
            </div>
        </section>
    );
}

// Export individual widgets for flexibility
export { WeakWordsWidget, ModePerformanceWidget, BestTimeWidget };
