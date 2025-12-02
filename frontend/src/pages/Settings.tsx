import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/flowpilot';
import { getSettings, updateSettings } from '@/lib/api';
import { Loader2, Settings as SettingsIcon, User, Clock, Github, Save } from 'lucide-react';

const timezones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

export default function Settings() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [githubUsername, setGithubUsername] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Load profile from Supabase for display name and email
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        throw error;
      }

      const profileData = data as Profile;
      setProfile(profileData);
      setDisplayName(profileData.display_name || '');
      setGithubUsername(profileData.github_username || '');

      // Load planning-related settings from backend
      try {
        const settings = await getSettings();
        setTimezone(settings.timezone || profileData.timezone || 'America/New_York');
        setWorkStart(settings.workStart || profileData.work_start_time || '09:00');
        setWorkEnd(settings.workEnd || profileData.work_end_time || '17:00');
      } catch {
        // Fallback to profile values if backend settings not available
        setTimezone(profileData.timezone || 'America/New_York');
        setWorkStart(profileData.work_start_time || '09:00');
        setWorkEnd(profileData.work_end_time || '17:00');
      }
    } catch (error: any) {
      toast({
        title: 'Error loading profile',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    setSaving(true);

    try {
      // Save profile data in Supabase (for display name and GitHub username)
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          github_username: githubUsername || null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Save planning settings in backend for FlowPilot
      await updateSettings({
        timezone,
        workStart,
        workEnd,
      });

      toast({
        title: 'Settings saved',
        description: 'Your preferences have been updated.',
      });
    } catch (error: any) {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <SettingsIcon className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Manage your preferences</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Profile Section */}
            <div className="glass-card rounded-xl p-6 border border-border/50">
              <div className="flex items-center gap-2 mb-6">
                <User className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Profile</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-secondary/30"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="bg-secondary/50"
                  />
                </div>
              </div>
            </div>

            {/* Work Hours Section */}
            <div className="glass-card rounded-xl p-6 border border-border/50">
              <div className="flex items-center gap-2 mb-6">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Work Hours</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="workStart">Default Work Start</Label>
                    <Input
                      id="workStart"
                      type="time"
                      value={workStart}
                      onChange={(e) => setWorkStart(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workEnd">Default Work End</Label>
                    <Input
                      id="workEnd"
                      type="time"
                      value={workEnd}
                      onChange={(e) => setWorkEnd(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Integrations Section */}
            <div className="glass-card rounded-xl p-6 border border-border/50">
              <div className="flex items-center gap-2 mb-6">
                <Github className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Integrations</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="githubUsername">GitHub Username</Label>
                  <Input
                    id="githubUsername"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    placeholder="your-username"
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for fetching assigned issues (coming soon)
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <Button
              variant="glow"
              size="lg"
              className="w-full"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
