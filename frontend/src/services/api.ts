import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// ==================== AUTH API ====================
export const authApi = {
    register: (data: { email: string; password: string; name?: string }) =>
        api.post('/auth/register', data),

    login: (data: { email: string; password: string }) =>
        api.post('/auth/login', data),

    me: () => api.get('/auth/me'),
};

// ==================== STUDY API ====================
export const studyApi = {
    getDueCards: (limit = 20) =>
        api.get(`/study/due?limit=${limit}`),

    getNewCards: (limit = 10) =>
        api.get(`/study/new?limit=${limit}`),

    // Get study queue grouped by priority (Tree Model)
    getQueue: (deck?: string, dailyLimit = 20) =>
        api.get(`/study/queue?dailyLimit=${dailyLimit}${deck ? `&deck=${deck}` : ''}`),

    learnCard: (vocabularyId: number) =>
        api.post(`/study/learn/${vocabularyId}`),

    learnDeck: (deck: string, limit = 20) =>
        api.post('/study/learn-deck', { deck, limit }),

    submitReview: (data: {
        cardId: string;
        rating: number;
        studyMode: string;
        responseTime?: number;
    }) => api.post('/study/review', data),

    startSession: (mode: string, limit = 20) =>
        api.post('/study/session/start', { mode, limit }),

    completeSession: (sessionId: string) =>
        api.post(`/study/session/${sessionId}/complete`),

    getStats: (deck?: string) => api.get(`/study/stats${deck ? `?deck=${deck}` : ''}`),

    getProgress: () => api.get('/study/stats/progress'),

    getAnalytics: () => api.get('/study/analytics'),
};

// ==================== VOCABULARY API ====================
export const vocabularyApi = {
    getAll: (page = 1, limit = 50, cefr?: string, deck?: string) =>
        api.get(`/vocabulary?page=${page}&limit=${limit}${cefr ? `&cefr=${cefr}` : ''}${deck ? `&deck=${deck}` : ''}`),

    search: (query: string) =>
        api.get(`/vocabulary/search?q=${query}`),

    getById: (id: number) =>
        api.get(`/vocabulary/${id}`),

    getCefrStats: () =>
        api.get('/vocabulary/stats/cefr'),

    getDeckStats: () =>
        api.get('/vocabulary/stats/decks'),

    getDecks: () =>
        api.get('/vocabulary/decks'),

    getRandom: (count: number, cefr?: string, exclude?: number[]) =>
        api.get(`/vocabulary/random/${count}${cefr ? `?cefr=${cefr}` : ''}${exclude?.length ? `&exclude=${exclude.join(',')}` : ''}`),
};

// ==================== USER API ====================
export const userApi = {
    updateProfile: (data: { name: string }) =>
        api.put('/user/profile', data),

    updateEmail: (data: { email: string; password: string }) =>
        api.put('/user/email', data),

    updatePassword: (data: { currentPassword: string; newPassword: string }) =>
        api.put('/user/password', data),

    updatePreferences: (data: { preferences: { theme?: 'dark' | 'light'; dailyNewCards?: number } }) =>
        api.put('/user/preferences', data),

    resetLearning: () =>
        api.post('/user/reset-learning'),

    deleteAccount: (data: { password: string }) =>
        api.delete('/user', { data }),
};

export default api;
