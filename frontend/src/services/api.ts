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

    updatePreferences: (prefs: {
        dailyGoal?: number;
        soundEnabled?: boolean;
        autoPlayAudio?: boolean;
        showIPA?: boolean;
        theme?: 'light' | 'dark' | 'system';
    }) => api.patch('/auth/me/preferences', prefs),
};

// ==================== STUDY API ====================
export const studyApi = {
    getDueCards: (limit = 20) =>
        api.get(`/study/due?limit=${limit}`),

    getNewCards: (limit = 10) =>
        api.get(`/study/new?limit=${limit}`),

    learnCard: (vocabularyId: number) =>
        api.post(`/study/learn/${vocabularyId}`),

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

    getStats: () => api.get('/study/stats'),

    getProgress: () => api.get('/study/stats/progress'),
};

// ==================== VOCABULARY API ====================
export const vocabularyApi = {
    getAll: (page = 1, limit = 50, cefr?: string) =>
        api.get(`/vocabulary?page=${page}&limit=${limit}${cefr ? `&cefr=${cefr}` : ''}`),

    search: (query: string) =>
        api.get(`/vocabulary/search?q=${query}`),

    getById: (id: number) =>
        api.get(`/vocabulary/${id}`),

    getCefrStats: () =>
        api.get('/vocabulary/stats/cefr'),

    getRandom: (count: number, cefr?: string, exclude?: number[]) =>
        api.get(`/vocabulary/random/${count}${cefr ? `?cefr=${cefr}` : ''}${exclude?.length ? `&exclude=${exclude.join(',')}` : ''}`),
};

export default api;
