import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ==================== AUTH STORE ====================
interface User {
    id: string;
    email: string;
    name?: string;
    preferences?: string; // JSON string
}

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
interface StudyState {
    currentSession: {
        id: string;
        mode: string;
        cards: any[];
        currentIndex: number;
    } | null;
    stats: {
        totalCards: number;
        reviewsToday: number;
        dueToday: number;
    };
    startSession: (session: { id: string; mode: string; cards: any[] }) => void;
    nextCard: () => void;
    endSession: () => void;
    setStats: (stats: any) => void;
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

// ==================== SETTINGS STORE ====================
interface SettingsState {
    theme: 'light' | 'dark';
    dailyGoal: number;
    soundEnabled: boolean;
    toggleTheme: () => void;
    setDailyGoal: (goal: number) => void;
    toggleSound: () => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            theme: 'dark',
            dailyGoal: 20,
            soundEnabled: true,
            toggleTheme: () =>
                set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
            setDailyGoal: (goal) => set({ dailyGoal: goal }),
            toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
        }),
        { name: 'settings-storage' }
    )
);
