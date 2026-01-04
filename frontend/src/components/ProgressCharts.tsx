import { useQuery } from '@tanstack/react-query';
import { studyApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame, Target, TrendingUp, Award } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
} from 'recharts';

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

export default function ProgressCharts() {
    const { data, isLoading } = useQuery<ProgressData>({
        queryKey: ['progress-stats'],
        queryFn: async () => {
            const response = await studyApi.getProgress();
            return response.data;
        },
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 animate-pulse">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="h-24 bg-slate-800/50" />
                ))}
            </div>
        );
    }

    const stats = [
        {
            title: 'Streak',
            value: data?.streak || 0,
            suffix: 'days',
            icon: Flame,
            color: 'text-orange-400',
            bgColor: 'bg-orange-500/20',
        },
        {
            title: 'Accuracy',
            value: data?.overallAccuracy || 0,
            suffix: '%',
            icon: Target,
            color: 'text-emerald-400',
            bgColor: 'bg-emerald-500/20',
        },
        {
            title: 'Reviews',
            value: data?.totalReviews || 0,
            suffix: 'this week',
            icon: TrendingUp,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/20',
        },
        {
            title: 'Best Day',
            value: data?.bestDay || 'N/A',
            suffix: '',
            icon: Award,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/20',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.title} className="overflow-hidden">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                                        <Icon className={`size-5 ${stat.color}`} />
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-400">{stat.title}</div>
                                        <div className="text-xl font-bold text-slate-100">
                                            {stat.value}
                                            {stat.suffix && <span className="text-xs ml-1 text-slate-400">{stat.suffix}</span>}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Reviews Chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Weekly Reviews</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data?.dailyStats || []}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis
                                        dataKey="dayName"
                                        stroke="#94a3b8"
                                        fontSize={12}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        stroke="#94a3b8"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1e293b',
                                            border: '1px solid #475569',
                                            borderRadius: '8px',
                                        }}
                                        labelStyle={{ color: '#f8fafc' }}
                                    />
                                    <Bar
                                        dataKey="reviews"
                                        fill="url(#colorReviews)"
                                        radius={[4, 4, 0, 0]}
                                        name="Reviews"
                                    />
                                    <defs>
                                        <linearGradient id="colorReviews" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#667eea" />
                                            <stop offset="100%" stopColor="#764ba2" />
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Accuracy Chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Accuracy Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data?.dailyStats || []}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis
                                        dataKey="dayName"
                                        stroke="#94a3b8"
                                        fontSize={12}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        stroke="#94a3b8"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        domain={[0, 100]}
                                        tickFormatter={(value: number) => `${value}%`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1e293b',
                                            border: '1px solid #475569',
                                            borderRadius: '8px',
                                        }}
                                        labelStyle={{ color: '#f8fafc' }}
                                        formatter={(value: number) => [`${value}%`, 'Accuracy']}
                                    />
                                    <defs>
                                        <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.1} />
                                        </linearGradient>
                                    </defs>
                                    <Area
                                        type="monotone"
                                        dataKey="accuracy"
                                        stroke="#22c55e"
                                        fill="url(#colorAccuracy)"
                                        strokeWidth={2}
                                        name="Accuracy"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
