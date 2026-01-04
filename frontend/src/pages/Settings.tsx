import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { authApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, Volume2, Eye, Target, Palette, Loader2 } from 'lucide-react';

interface Preferences {
    dailyGoal: number;
    soundEnabled: boolean;
    autoPlayAudio: boolean;
    showIPA: boolean;
    theme: 'light' | 'dark' | 'system';
}

const defaultPreferences: Preferences = {
    dailyGoal: 20,
    soundEnabled: true,
    autoPlayAudio: true,
    showIPA: true,
    theme: 'dark',
};

export default function Settings() {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [preferences, setPreferences] = useState<Preferences>(() => {
        const saved = user?.preferences ? JSON.parse(user.preferences) : {};
        return { ...defaultPreferences, ...saved };
    });

    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            await authApi.updatePreferences(preferences);
            setSaveStatus('success');
            // Hide success message after 3 seconds
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (error) {
            console.error('Failed to save preferences:', error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = (key: keyof Preferences) => {
        setPreferences(prev => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    return (
        <div className="min-h-screen min-h-dvh w-full bg-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur">
                <div className="max-w-2xl mx-auto flex h-16 items-center justify-between px-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                        <ArrowLeft className="size-4 mr-2" />
                        Back
                    </Button>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                        Settings
                    </h1>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <>
                                <Save className="size-4 mr-2" />
                                Save
                            </>
                        )}
                    </Button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                {/* Daily Goal */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/20">
                                <Target className="size-5 text-blue-400" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Daily Goal</CardTitle>
                                <CardDescription>Cards to review per day</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={preferences.dailyGoal}
                                onChange={(e) => setPreferences(prev => ({
                                    ...prev,
                                    dailyGoal: parseInt(e.target.value) || 20,
                                }))}
                                className="w-24"
                            />
                            <span className="text-slate-400">cards/day</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Sound Settings */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/20">
                                <Volume2 className="size-5 text-purple-400" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Sound</CardTitle>
                                <CardDescription>Audio and pronunciation settings</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <ToggleOption
                            label="Enable Sound"
                            description="Play audio effects"
                            checked={preferences.soundEnabled}
                            onChange={() => handleToggle('soundEnabled')}
                        />
                        <ToggleOption
                            label="Auto-play Audio"
                            description="Play pronunciation when flipping cards"
                            checked={preferences.autoPlayAudio}
                            onChange={() => handleToggle('autoPlayAudio')}
                        />
                    </CardContent>
                </Card>

                {/* Display Settings */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/20">
                                <Eye className="size-5 text-emerald-400" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Display</CardTitle>
                                <CardDescription>Visual appearance settings</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <ToggleOption
                            label="Show IPA"
                            description="Display phonetic transcription"
                            checked={preferences.showIPA}
                            onChange={() => handleToggle('showIPA')}
                        />
                    </CardContent>
                </Card>

                {/* Theme */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-500/20">
                                <Palette className="size-5 text-orange-400" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Theme</CardTitle>
                                <CardDescription>Choose your preferred theme</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            {(['dark', 'light', 'system'] as const).map((theme) => (
                                <Button
                                    key={theme}
                                    variant={preferences.theme === theme ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setPreferences(prev => ({ ...prev, theme }))}
                                    className="capitalize"
                                >
                                    {theme}
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Save Status */}
                {saveStatus === 'success' && (
                    <div className="text-center text-emerald-400 text-sm">
                        ✓ Settings saved successfully
                    </div>
                )}
                {saveStatus === 'error' && (
                    <div className="text-center text-red-400 text-sm">
                        ✗ Failed to save settings
                    </div>
                )}
            </main>
        </div>
    );
}

// Toggle Option Component
function ToggleOption({
    label,
    description,
    checked,
    onChange
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: () => void;
}) {
    return (
        <div
            className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 cursor-pointer hover:bg-slate-800 transition-colors"
            onClick={onChange}
        >
            <div>
                <div className="font-medium text-slate-100">{label}</div>
                <div className="text-sm text-slate-400">{description}</div>
            </div>
            <div
                className={`w-12 h-7 rounded-full transition-colors flex items-center px-1 ${checked ? 'bg-primary' : 'bg-slate-600'
                    }`}
            >
                <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'
                        }`}
                />
            </div>
        </div>
    );
}
