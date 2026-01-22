import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, CardWithVocabulary, StudyModeType } from '@/types/schema';

// ==================== AUTH STORE ====================

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    setAuth: (user: User, token: string) => void;
    setUser: (user: User) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            setAuth: (user, token) => {
                localStorage.setItem('token', token);
                set({ user, token, isAuthenticated: true });
            },
            setUser: (user) => set({ user }),
            logout: () => {
                localStorage.removeItem('token');
                set({ user: null, token: null, isAuthenticated: false });
            },
        }),
        { name: 'auth-storage' }
    )
);

// ==================== STUDY STORE ====================

/** Session state for single-mode study */
interface StudySessionState {
    id: string;
    mode: StudyModeType;
    cards: CardWithVocabulary[];
    currentIndex: number;
}

/** Stats displayed on dashboard/deck pages */
interface StudyStats {
    totalCards: number;
    reviewsToday: number;
    dueToday: number;
}

interface StudyState {
    currentSession: StudySessionState | null;
    stats: StudyStats;
    startSession: (session: { id: string; mode: StudyModeType; cards: CardWithVocabulary[] }) => void;
    nextCard: () => void;
    endSession: () => void;
    setStats: (stats: StudyStats) => void;
}

export const useStudyStore = create<StudyState>((set) => ({
    currentSession: null,
    stats: {
        totalCards: 0,
        reviewsToday: 0,
        dueToday: 0,
    },
    startSession: (session) =>
        set({ currentSession: { ...session, currentIndex: 0 } }),
    nextCard: () =>
        set((state) => ({
            currentSession: state.currentSession
                ? {
                    ...state.currentSession,
                    currentIndex: state.currentSession.currentIndex + 1,
                }
                : null,
        })),
    endSession: () => set({ currentSession: null }),
    setStats: (stats) => set({ stats }),
}));

// ==================== THEME STORE ====================
type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
    theme: ThemeMode;
    setTheme: (theme: ThemeMode) => void;
    applyTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: 'dark',
            setTheme: (theme) => {
                set({ theme });
                // Apply theme immediately
                get().applyTheme();
            },
            applyTheme: () => {
                const { theme } = get();
                const root = document.documentElement;

                root.classList.remove('dark', 'light');

                if (theme === 'system') {
                    // Let CSS handle it via media query
                    return;
                }

                root.classList.add(theme);
            },
        }),
        {
            name: 'theme-storage',
            onRehydrateStorage: () => (state) => {
                // Apply theme when store is rehydrated
                state?.applyTheme();
            },
        }
    )
);
