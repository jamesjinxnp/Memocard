import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, useStudyStore } from '@/stores';
import { studyApi, vocabularyApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { LogOut, Settings, Library, BarChart3, Rocket, BookOpen } from 'lucide-react';
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

  const deckGradients: Record<string, string> = {
    emerald: 'from-accent-teal to-accent-teal-dark',
    blue: 'from-accent-sky to-primary',
    purple: 'from-primary to-secondary',
  };

  const deckGlows: Record<string, string> = {
    emerald: 'hover:shadow-accent-teal/15',
    blue: 'hover:shadow-accent-sky/15',
    purple: 'hover:shadow-primary/15',
  };

  return (
    <div className="min-h-screen min-h-dvh w-full bg-deep">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-[var(--color-border-default)] bg-[var(--color-bg-deep)]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="text-xl font-bold font-display text-gradient">
            Memocard
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline text-sm text-[var(--color-text-secondary)]">
              {user?.name || user?.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/analytics')}
              title="Analytics"
              className="text-[var(--color-text-secondary)] hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <BarChart3 className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/settings')}
              title="Settings"
              className="text-[var(--color-text-secondary)] hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Settings className="size-5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="gap-1.5 border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-accent-rose hover:border-accent-rose/30 hover:bg-accent-rose/5 transition-colors"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8 md:space-y-10">
        {/* Progress Section */}
        <section>
          <h2 className="text-lg font-semibold font-display text-[var(--color-text-primary)] mb-4">
            Your Progress
          </h2>
          <ProgressCharts todayStats={statsData} />
        </section>

        {/* Deck Selection Section */}
        <section>
          <h2 className="text-lg font-semibold font-display text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <Library className="size-5 text-primary" />
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

            {/* Deck Cards */}
            {!decksLoading && decksData?.decks?.map((deck: Deck) => {
              const gradientClass = deckGradients[deck.color] || 'from-muted to-muted-foreground/20';
              const glowClass = deckGlows[deck.color] || 'hover:shadow-primary/15';

              return (
                <div
                  key={deck.id}
                  className={`
                    relative overflow-hidden rounded-xl
                    border border-[var(--color-border-default)]
                    bg-[var(--color-bg-surface)]
                    p-5 flex flex-col justify-between
                    glow-border
                    ${glowClass}
                    hover:shadow-xl
                    transition-all duration-200
                    group
                  `}
                >
                  {/* Background gradient accent */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-300 pointer-events-none`} />

                  {/* Content */}
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg font-display text-[var(--color-text-primary)]">
                          {deck.name}
                        </h3>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                          {deck.description}
                        </p>
                      </div>
                      <div className={`inline-flex items-center px-2.5 py-1 rounded-full bg-gradient-to-r ${gradientClass} text-white text-xs font-semibold tracking-wide shadow-sm`}>
                        {deck.wordCount.toLocaleString()}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        onClick={() => navigate(`/path/${deck.id}`)}
                        className={`flex-1 bg-gradient-to-r ${gradientClass} text-white shadow-lg hover:opacity-90 border-0 active:scale-[0.97] transition-transform duration-100 gap-1.5`}
                      >
                        <Rocket className="size-4" />
                        Start Path
                      </Button>
                      <Button
                        onClick={() => navigate(`/deck/${deck.id}`)}
                        variant="secondary"
                        className="flex-1 bg-[var(--color-bg-elevated)] hover:bg-primary/10 text-[var(--color-text-primary)] border border-[var(--color-border-default)] active:scale-[0.97] transition-all duration-100 gap-1.5"
                      >
                        <BookOpen className="size-4" />
                        Library
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
