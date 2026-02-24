import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { authApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, BookMarked } from 'lucide-react';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = isRegister
        ? await authApi.register({ email, password, name })
        : await authApi.login({ email, password });

      const { user, token } = response.data;
      setAuth(user, token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-dvh w-full flex items-center justify-center p-6 bg-deep">
      {/* Ambient glow behind card */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-secondary/8 rounded-full blur-[100px]" />
      </div>

      <Card className="w-full max-w-md relative glass-card border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-2xl shadow-primary/5">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <BookMarked className="size-7 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold font-display text-gradient">
            Memocard
          </CardTitle>
          <CardDescription className="text-[var(--color-text-secondary)]">
            Learn vocabulary with spaced repetition
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">Name</label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="bg-[var(--color-bg-elevated)] border-[var(--color-border-default)] focus:border-primary focus:ring-primary/20"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="bg-[var(--color-bg-elevated)] border-[var(--color-border-default)] focus:border-primary focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="bg-[var(--color-bg-elevated)] border-[var(--color-border-default)] focus:border-primary focus:ring-primary/20"
              />
            </div>

            {error && (
              <div className="bg-accent-rose/10 text-accent-rose border border-accent-rose/20 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full gradient-primary text-white border-0 hover:opacity-90 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all duration-150"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Loading...
                </>
              ) : isRegister ? 'Create Account' : 'Login'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            {isRegister ? (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => setIsRegister(false)}
                  className="text-primary font-semibold hover:underline transition-colors"
                >
                  Login
                </button>
              </>
            ) : (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => setIsRegister(true)}
                  className="text-primary font-semibold hover:underline transition-colors"
                >
                  Register
                </button>
              </>
            )}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
