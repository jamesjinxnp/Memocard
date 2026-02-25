import type { ReactNode } from 'react';
import type { StudyModeType } from '@/types/schema';

// ==================== Mode Accent System ====================

const MODE_ACCENTS: Record<string, {
    gradient: string;
    glow: string;
    border: string;
    bg: string;
    icon: string;
}> = {
    reading: {
        gradient: 'from-purple-600 to-violet-700',
        glow: 'shadow-[0_0_40px_rgba(147,51,234,0.15)]',
        border: 'border-purple-500/20',
        bg: 'bg-purple-500/10',
        icon: '📖',
    },
    typing: {
        gradient: 'from-blue-600 to-indigo-700',
        glow: 'shadow-[0_0_40px_rgba(59,130,246,0.15)]',
        border: 'border-blue-500/20',
        bg: 'bg-blue-500/10',
        icon: '⌨️',
    },
    listening: {
        gradient: 'from-amber-600 to-orange-700',
        glow: 'shadow-[0_0_40px_rgba(245,158,11,0.15)]',
        border: 'border-amber-500/20',
        bg: 'bg-amber-500/10',
        icon: '🎧',
    },
    multiple_choice: {
        gradient: 'from-emerald-600 to-green-700',
        glow: 'shadow-[0_0_40px_rgba(16,185,129,0.15)]',
        border: 'border-emerald-500/20',
        bg: 'bg-emerald-500/10',
        icon: '🔤',
    },
    cloze: {
        gradient: 'from-cyan-600 to-teal-700',
        glow: 'shadow-[0_0_40px_rgba(6,182,212,0.15)]',
        border: 'border-cyan-500/20',
        bg: 'bg-cyan-500/10',
        icon: '📝',
    },
    spelling: {
        gradient: 'from-pink-600 to-rose-700',
        glow: 'shadow-[0_0_40px_rgba(236,72,153,0.15)]',
        border: 'border-pink-500/20',
        bg: 'bg-pink-500/10',
        icon: '🐝',
    },
    audio_choice: {
        gradient: 'from-violet-600 to-purple-700',
        glow: 'shadow-[0_0_40px_rgba(139,92,246,0.15)]',
        border: 'border-violet-500/20',
        bg: 'bg-violet-500/10',
        icon: '🔊',
    },
};

const DEFAULT_ACCENT = MODE_ACCENTS.reading;

export function getModeAccent(mode: string) {
    return MODE_ACCENTS[mode] || DEFAULT_ACCENT;
}

export function getModeIcon(mode: string) {
    return (MODE_ACCENTS[mode] || DEFAULT_ACCENT).icon;
}

// ==================== StudyCard Component ====================

interface StudyCardProps {
    mode: StudyModeType | string;
    children: ReactNode;
    className?: string;
    /** Disable glassmorphism for flip-card usage */
    transparent?: boolean;
}

export default function StudyCard({ mode, children, className = '', transparent = false }: StudyCardProps) {
    const accent = getModeAccent(mode);

    if (transparent) {
        return <div className={className}>{children}</div>;
    }

    return (
        <div
            className={`
        relative rounded-3xl overflow-hidden
        bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl
        border ${accent.border}
        ${accent.glow}
        transition-shadow duration-500
        ${className}
      `}
        >
            {children}
        </div>
    );
}
