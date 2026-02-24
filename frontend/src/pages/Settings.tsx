import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useThemeStore } from '@/stores';
import { userApi, authApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ArrowLeft, User, Mail, Lock, Palette, RotateCcw, Trash2, Sun, Moon, Check, X, Loader2, ChevronRight } from 'lucide-react';

export default function Settings() {
    const { user, setUser, logout } = useAuthStore();
    const { theme, setTheme } = useThemeStore();
    const navigate = useNavigate();

    // Form states
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [emailPassword, setEmailPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [deletePassword, setDeletePassword] = useState('');

    // Modal states
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // UI states
    const [loading, setLoading] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Reset messages after 3 seconds
    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess(null);
                setError(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

    // Reset form when modals close
    const closeProfileModal = () => {
        setShowProfileModal(false);
        setName(user?.name || '');
        setError(null);
    };

    const closeEmailModal = () => {
        setShowEmailModal(false);
        setEmail(user?.email || '');
        setEmailPassword('');
        setError(null);
    };

    const closePasswordModal = () => {
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError(null);
    };

    const handleUpdateName = async () => {
        if (!name.trim()) return;
        setLoading('name');
        setError(null);
        try {
            const response = await userApi.updateProfile({ name: name.trim() });
            setUser(response.data.user);
            setSuccess('Name updated successfully');
            setShowProfileModal(false);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update name');
        } finally {
            setLoading(null);
        }
    };

    const handleUpdateEmail = async () => {
        if (!email.trim() || !emailPassword) return;
        setLoading('email');
        setError(null);
        try {
            await userApi.updateEmail({ email: email.trim(), password: emailPassword });
            const meResponse = await authApi.me();
            setUser(meResponse.data.user);
            setEmailPassword('');
            setSuccess('Email updated successfully');
            setShowEmailModal(false);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update email');
        } finally {
            setLoading(null);
        }
    };

    const handleUpdatePassword = async () => {
        if (!currentPassword || !newPassword) return;
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        setLoading('password');
        setError(null);
        try {
            await userApi.updatePassword({ currentPassword, newPassword });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setSuccess('Password updated successfully');
            setShowPasswordModal(false);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update password');
        } finally {
            setLoading(null);
        }
    };

    const handleResetLearning = async () => {
        setLoading('reset');
        setError(null);
        try {
            await userApi.resetLearning();
            setShowResetConfirm(false);
            setSuccess('All learning progress has been reset');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to reset learning');
        } finally {
            setLoading(null);
        }
    };

    const handleDeleteAccount = async () => {
        if (!deletePassword) return;
        setLoading('delete');
        setError(null);
        try {
            await userApi.deleteAccount({ password: deletePassword });
            logout();
            navigate('/login');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to delete account');
            setLoading(null);
        }
    };

    const themeOptions: { value: 'dark' | 'light'; label: string; icon: typeof Sun }[] = [
        { value: 'dark', label: 'Dark', icon: Moon },
        { value: 'light', label: 'Light', icon: Sun },
    ];

    return (
        <div className="min-h-screen min-h-dvh w-full bg-deep">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-[var(--color-border-default)] bg-[var(--color-bg-deep)]/95 backdrop-blur">
                <div className="max-w-2xl mx-auto flex h-16 items-center gap-4 px-4 md:px-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                        <ArrowLeft className="size-5" />
                    </Button>
                    <h1 className="text-xl font-bold font-display text-gradient">
                        Settings
                    </h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-6">
                {/* Success/Error Messages */}
                {success && (
                    <div className="flex items-center gap-2 bg-emerald-900/50 text-emerald-200 p-4 rounded-xl border border-emerald-700">
                        <Check className="size-5" />
                        {success}
                    </div>
                )}
                {error && !showProfileModal && !showEmailModal && !showPasswordModal && (
                    <div className="flex items-center gap-2 bg-red-900/50 text-red-200 p-4 rounded-xl border border-red-700">
                        <X className="size-5" />
                        {error}
                    </div>
                )}

                {/* Account Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Account</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Profile Button */}
                        <button
                            onClick={() => setShowProfileModal(true)}
                            className="w-full flex items-center justify-between px-6 py-4 hover:bg-primary/5 transition-colors border-b border-[var(--color-border-default)]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                                    <User className="size-5 text-white" />
                                </div>
                                <div className="text-left">
                                    <div className="font-medium text-[var(--color-text-primary)]">Profile</div>
                                    <div className="text-sm text-[var(--color-text-secondary)]">{user?.name || 'No name set'}</div>
                                </div>
                            </div>
                            <ChevronRight className="size-5 text-[var(--color-text-muted)]" />
                        </button>

                        {/* Email Button */}
                        <button
                            onClick={() => setShowEmailModal(true)}
                            className="w-full flex items-center justify-between px-6 py-4 hover:bg-primary/5 transition-colors border-b border-[var(--color-border-default)]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <Mail className="size-5 text-blue-400" />
                                </div>
                                <div className="text-left">
                                    <div className="font-medium text-[var(--color-text-primary)]">Email</div>
                                    <div className="text-sm text-[var(--color-text-secondary)]">{user?.email}</div>
                                </div>
                            </div>
                            <ChevronRight className="size-5 text-[var(--color-text-muted)]" />
                        </button>

                        {/* Password Button */}
                        <button
                            onClick={() => setShowPasswordModal(true)}
                            className="w-full flex items-center justify-between px-6 py-4 hover:bg-primary/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                                    <Lock className="size-5 text-amber-400" />
                                </div>
                                <div className="text-left">
                                    <div className="font-medium text-[var(--color-text-primary)]">Password</div>
                                    <div className="text-sm text-[var(--color-text-secondary)]">••••••••</div>
                                </div>
                            </div>
                            <ChevronRight className="size-5 text-[var(--color-text-muted)]" />
                        </button>
                    </CardContent>
                </Card>

                {/* Theme Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Palette className="size-5" />
                            Appearance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            {themeOptions.map((option) => {
                                const Icon = option.icon;
                                const isActive = theme === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => setTheme(option.value)}
                                        className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${isActive
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-[var(--color-border-default)] hover:border-primary/30 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                            }`}
                                    >
                                        <Icon className="size-6" />
                                        <span className="text-sm font-medium">{option.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="border-red-900/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg text-red-400">
                            ⚠️ Danger Zone
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Reset Learning */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-bg-elevated)]/50 border border-[var(--color-border-default)]">
                            <div>
                                <div className="font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                                    <RotateCcw className="size-4" />
                                    Reset Learning Progress
                                </div>
                                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                                    Remove all your cards and review history.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setShowResetConfirm(true)}
                                className="border-amber-600 text-amber-400 hover:bg-amber-900/20"
                            >
                                Reset
                            </Button>
                        </div>

                        {/* Delete Account */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-bg-elevated)]/50 border border-[var(--color-border-default)]">
                            <div>
                                <div className="font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                                    <Trash2 className="size-4" />
                                    Delete Account
                                </div>
                                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                                    Permanently delete your account and all data.
                                </p>
                            </div>
                            <Button
                                variant="destructive"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                Delete
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </main>

            {/* Profile Modal */}
            {showProfileModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <Card className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="size-5" />
                                Change Name
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {error && (
                                <div className="flex items-center gap-2 bg-red-900/50 text-red-200 p-3 rounded-lg text-sm">
                                    <X className="size-4" />
                                    {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm text-[var(--color-text-secondary)]">Display Name</label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your name"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={closeProfileModal}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleUpdateName}
                                    disabled={loading === 'name' || !name.trim() || name === user?.name}
                                >
                                    {loading === 'name' ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Email Modal */}
            {showEmailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <Card className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="size-5" />
                                Change Email
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {error && (
                                <div className="flex items-center gap-2 bg-red-900/50 text-red-200 p-3 rounded-lg text-sm">
                                    <X className="size-4" />
                                    {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm text-[var(--color-text-secondary)]">New Email Address</label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-[var(--color-text-secondary)]">Confirm with Password</label>
                                <Input
                                    type="password"
                                    value={emailPassword}
                                    onChange={(e) => setEmailPassword(e.target.value)}
                                    placeholder="Enter your password"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={closeEmailModal}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleUpdateEmail}
                                    disabled={loading === 'email' || !email.trim() || !emailPassword || email === user?.email}
                                >
                                    {loading === 'email' ? <Loader2 className="size-4 animate-spin" /> : 'Update Email'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <Card className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Lock className="size-5" />
                                Change Password
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {error && (
                                <div className="flex items-center gap-2 bg-red-900/50 text-red-200 p-3 rounded-lg text-sm">
                                    <X className="size-4" />
                                    {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm text-[var(--color-text-secondary)]">Current Password</label>
                                <Input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-[var(--color-text-secondary)]">New Password</label>
                                <Input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-[var(--color-text-secondary)]">Confirm New Password</label>
                                <Input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={closePasswordModal}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleUpdatePassword}
                                    disabled={loading === 'password' || !currentPassword || !newPassword || !confirmPassword}
                                >
                                    {loading === 'password' ? <Loader2 className="size-4 animate-spin" /> : 'Change Password'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle className="text-amber-400">⚠️ Reset Learning Progress?</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-[var(--color-text-secondary)]">
                                This will delete all your cards, review history, and study sessions.
                                You'll need to add cards again from the vocabulary list.
                            </p>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="warning"
                                    onClick={handleResetLearning}
                                    disabled={loading === 'reset'}
                                >
                                    {loading === 'reset' ? <Loader2 className="size-4 animate-spin" /> : 'Yes, Reset'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle className="text-red-400">🗑️ Delete Account?</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-[var(--color-text-secondary)]">
                                This action is <strong>permanent</strong> and cannot be undone.
                                All your data will be deleted forever.
                            </p>
                            <div className="space-y-2">
                                <label className="text-sm text-[var(--color-text-secondary)]">Enter your password to confirm</label>
                                <Input
                                    type="password"
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    placeholder="Your password"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setDeletePassword('');
                                }}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleDeleteAccount}
                                    disabled={loading === 'delete' || !deletePassword}
                                >
                                    {loading === 'delete' ? <Loader2 className="size-4 animate-spin" /> : 'Delete My Account'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
