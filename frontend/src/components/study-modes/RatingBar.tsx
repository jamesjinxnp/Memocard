interface RatingBarProps {
    onRate: (rating: number) => void;
    showSchedule?: {
        again: number;
        hard: number;
        good: number;
        easy: number;
    };
}

const RATINGS = [
    { value: 1, label: 'Again', emoji: '❌', color: 'from-red-600 to-red-700', glow: 'hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]', border: 'border-red-500/30' },
    { value: 2, label: 'Hard', emoji: '😤', color: 'from-orange-600 to-orange-700', glow: 'hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]', border: 'border-orange-500/30' },
    { value: 3, label: 'Good', emoji: '✅', color: 'from-green-600 to-green-700', glow: 'hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]', border: 'border-green-500/30' },
    { value: 4, label: 'Easy', emoji: '⭐', color: 'from-blue-600 to-blue-700', glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]', border: 'border-blue-500/30' },
];

export default function RatingBar({ onRate, showSchedule }: RatingBarProps) {
    const scheduleValues = showSchedule
        ? [showSchedule.again, showSchedule.hard, showSchedule.good, showSchedule.easy]
        : null;

    return (
        <div className="flex flex-wrap gap-3 justify-center w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            {RATINGS.map((r, i) => (
                <button
                    key={r.value}
                    onClick={() => onRate(r.value)}
                    className={`
            flex flex-col items-center min-h-14 min-w-[76px] py-3 px-5
            rounded-2xl
            bg-gradient-to-br ${r.color}
            border ${r.border}
            backdrop-blur-sm
            text-white font-semibold
            transition-all duration-200
            active:scale-90
            ${r.glow}
          `}
                >
                    <span className="text-base">{r.label}</span>
                    {scheduleValues && (
                        <span className="text-xs opacity-70 mt-0.5">{scheduleValues[i]}d</span>
                    )}
                </button>
            ))}
        </div>
    );
}
