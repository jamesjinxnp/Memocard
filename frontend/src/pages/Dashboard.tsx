import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, useStudyStore } from '@/stores';
import { studyApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Keyboard, Headphones, Target, FileText, Sparkles, LogOut, Plus, Settings } from 'lucide-react';
import ProgressCharts from '@/components/ProgressCharts';

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

  useEffect(() => {
    if (statsData) {
      setStats(statsData);
    }
  }, [statsData, setStats]);

  const studyModes = [
    { id: 'reading', name: 'Reading', icon: BookOpen, desc: 'Flashcard flip', color: 'from-violet-500 to-purple-500' },
    { id: 'typing', name: 'Typing', icon: Keyboard, desc: 'Spelling practice', color: 'from-blue-500 to-cyan-500' },
    { id: 'listening', name: 'Listening', icon: Headphones, desc: 'Audio only', color: 'from-pink-500 to-rose-500' },
    { id: 'multiple_choice', name: 'Multiple Choice', icon: Target, desc: 'Pick the answer', color: 'from-emerald-500 to-green-500' },
    { id: 'cloze', name: 'Cloze', icon: FileText, desc: 'Fill in the blank', color: 'from-amber-500 to-orange-500' },
    { id: 'spelling_bee', name: 'Spelling Bee', icon: Sparkles, desc: 'Hardcore mode', color: 'from-red-500 to-pink-500' },
    { id: 'audio_choice', name: 'Audio Choice', icon: Headphones, desc: 'ฟังเลือกตอบ', color: 'from-purple-500 to-indigo-500' },
  ];

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
            <Button variant="default" size="sm" onClick={() => navigate('/browse')}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Add Cards</span>
            </Button>
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
        {/* Stats Section */}
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Today's Progress</h2>
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-4 md:p-6 text-center">
                <div className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {statsData?.dueToday || 0}
                </div>
                <div className="text-xs md:text-sm text-slate-400 mt-1">Cards Due</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4 md:p-6 text-center">
                <div className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {statsData?.reviewsToday || 0}
                </div>
                <div className="text-xs md:text-sm text-slate-400 mt-1">Reviews Today</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4 md:p-6 text-center">
                <div className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {statsData?.totalCards || 0}
                </div>
                <div className="text-xs md:text-sm text-slate-400 mt-1">Total Cards</div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Progress Charts Section */}
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Weekly Progress</h2>
          <ProgressCharts />
        </section>

        {/* Study Modes Section */}
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Study Modes</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {studyModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => navigate(`/study/${mode.id}`)}
                  className="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 md:p-6 text-center transition-all hover:scale-105 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${mode.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                  <div className="relative z-10">
                    <div className={`inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br ${mode.color} text-white mb-3`}>
                      <Icon className="size-6 md:size-7" />
                    </div>
                    <div className="font-medium text-sm md:text-base text-slate-100">{mode.name}</div>
                    <div className="text-xs text-slate-400 mt-1">{mode.desc}</div>
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
