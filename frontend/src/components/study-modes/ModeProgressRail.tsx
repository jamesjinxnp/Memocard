import { getModeIcon } from './StudyCard';
import type { StudyModeType } from '@/types/schema';

interface ModeProgressRailProps {
    modeQueue: StudyModeType[];
    currentModeIndex: number;
    retryQueue: StudyModeType[];
}

const MODE_SHORT: Record<string, string> = {
    reading: 'Read',
    typing: 'Type',
    listening: 'Listen',
    multiple_choice: 'MC',
    cloze: 'Cloze',
    spelling: 'Spell',
    audio_choice: 'Audio',
};

export default function ModeProgressRail({
    modeQueue,
    currentModeIndex,
    retryQueue,
}: ModeProgressRailProps) {
    return (
        <div className="flex items-center justify-center gap-1.5 py-3 px-4 overflow-x-auto">
            {modeQueue.map((mode, i) => {
                const isCompleted = i < currentModeIndex;
                const isCurrent = i === currentModeIndex && retryQueue.length === 0;
                const icon = getModeIcon(mode);

                return (
                    <div key={i} className="flex items-center gap-1.5">
                        {/* Connector line */}
                        {i > 0 && (
                            <div
                                className={`w-4 h-0.5 rounded-full transition-colors duration-300 ${isCompleted ? 'bg-emerald-500/50' : 'bg-white/10'
                                    }`}
                            />
                        )}

                        {/* Mode pill */}
                        <div
                            className={`
                flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                transition-all duration-300
                ${isCompleted
                                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                                    : isCurrent
                                        ? 'bg-white/10 border border-white/30 text-white scale-110 shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                                        : 'bg-white/5 border border-white/10 text-white/40'
                                }
              `}
                            title={MODE_SHORT[mode] || mode}
                        >
                            <span className="text-sm">{icon}</span>
                            {isCompleted && <span>✓</span>}
                        </div>
                    </div>
                );
            })}

            {/* Retry indicators */}
            {retryQueue.length > 0 && (
                <>
                    <div className="w-px h-4 bg-amber-500/30 mx-1" />
                    {retryQueue.map((mode, i) => (
                        <div
                            key={`retry-${i}`}
                            className={`
                flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                ${i === 0
                                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 scale-110'
                                    : 'bg-amber-500/10 border border-amber-500/20 text-amber-500/60'
                                }
              `}
                        >
                            <span className="text-sm">{getModeIcon(mode)}</span>
                            <span>↻</span>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}
