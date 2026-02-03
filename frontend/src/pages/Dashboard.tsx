import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, useStudyStore } from '@/stores';
import { studyApi, vocabularyApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { LogOut, Settings, Library, BarChart3 } from 'lucide-react';
import ProgressCharts from '@/components/ProgressCharts';
import { SkeletonDeck } from '@/components/ui/skeleton';

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
  const { data: decksData, isLoading: decksLoading } = useQuery({
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
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden sm:inline text-sm text-slate-400">
              👋 {user?.name || user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={() => navigate('/analytics')} title="Analytics">
              <BarChart3 className="size-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} title="Settings">
              <Settings className="size-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={logout} className="gap-1">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">
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
            {/* Skeleton Loading */}
            {decksLoading && (
              <>
                <SkeletonDeck />
                <SkeletonDeck />
                <SkeletonDeck />
              </>
            )}

            {/* Actual Decks */}
            {!decksLoading && decksData?.decks?.map((deck: Deck) => {
              const colorClass = deckColors[deck.color] || 'from-slate-500 to-slate-600';

              return (
                <div
                  key={deck.id}
                  className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5 flex flex-col justify-between hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${colorClass} opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none`} />

                  {/* Content */}
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg text-slate-100">{deck.name}</h3>
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">{deck.description}</p>
                      </div>
                      <div className={`inline-block px-2 py-0.5 rounded-full bg-gradient-to-r ${colorClass} text-white text-xs font-medium opacity-80`}>
                        {deck.wordCount.toLocaleString()}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => navigate(`/path/${deck.id}`)}
                        className={`flex-1 bg-gradient-to-r ${colorClass} text-white shadow-lg hover:opacity-90 border-0 active:scale-95 transition-transform duration-100`}
                      >
                        Start Path 🚀
                      </Button>
                      <Button
                        onClick={() => navigate(`/deck/${deck.id}`)}
                        variant="secondary"
                        className="flex-1 bg-slate-700/50 hover:bg-slate-700 text-slate-200 active:scale-95 transition-transform duration-100"
                      >
                        Library 📖
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
