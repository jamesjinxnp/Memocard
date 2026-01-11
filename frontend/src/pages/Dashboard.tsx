import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, useStudyStore } from '@/stores';
import { studyApi, vocabularyApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { LogOut, Settings, Library, ChevronRight } from 'lucide-react';
import ProgressCharts from '@/components/ProgressCharts';

interface Deck {
  id: string;
  name: string;
  description: string;
  color: string;
  wordCount: number;
}

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const { setStats } = useStudyStore();
  const navigate = useNavigate();

  // Fetch study stats
  const { data: statsData } = useQuery({
    queryKey: ['study-stats'],
    queryFn: async () => {
      const response = await studyApi.getStats();
      return response.data;
    },
  });

  // Fetch available decks
  const { data: decksData } = useQuery({
    queryKey: ['vocabulary-decks'],
    queryFn: async () => {
      const response = await vocabularyApi.getDecks();
      return response.data;
    },
  });

  useEffect(() => {
    if (statsData) {
      setStats(statsData);
    }
  }, [statsData, setStats]);

  const deckColors: Record<string, string> = {
    emerald: 'from-emerald-500 to-teal-500',
    blue: 'from-blue-500 to-indigo-500',
    purple: 'from-purple-500 to-pink-500',
  };

  return (
    <div className="min-h-screen min-h-dvh w-full bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-900/75">
        <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            📚 Memocard
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-sm text-slate-400">
              👋 {user?.name || user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <Settings className="size-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Progress Section - Heatmap + Today's Stats */}
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Your Progress</h2>
          <ProgressCharts todayStats={statsData} />
        </section>

        {/* Deck Selection Section */}
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Library className="size-5" />
            Vocabulary Decks
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {decksData?.decks?.map((deck: Deck) => {
              const colorClass = deckColors[deck.color] || 'from-slate-500 to-slate-600';

              return (
                <button
                  key={deck.id}
                  onClick={() => navigate(`/deck/${deck.id}`)}
                  className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5 text-left transition-all hover:border-primary/50 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10 group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${colorClass} opacity-5 group-hover:opacity-10 transition-opacity`} />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg text-slate-100">{deck.name}</h3>
                        <p className="text-sm text-slate-400 mt-1">{deck.description}</p>
                      </div>
                      <ChevronRight className="size-5 text-slate-400 group-hover:text-primary transition-colors" />
                    </div>
                    <div className={`inline-block px-3 py-1 rounded-full bg-gradient-to-r ${colorClass} text-white text-sm font-medium`}>
                      {deck.wordCount.toLocaleString()} words
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}


