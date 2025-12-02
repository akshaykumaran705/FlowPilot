import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { SessionCard } from '@/components/sessions/SessionCard';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Session } from '@/types/flowpilot';
import { listSessions, BackendSession } from '@/lib/api';
import { Loader2, FolderKanban } from 'lucide-react';

type StatusFilter = 'all' | 'active' | 'completed';

export default function Sessions() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user, filter]);

  const loadSessions = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const backendSessions = await listSessions(
        filter === 'all' ? undefined : filter,
      );

      const mapped: Session[] = backendSessions.map(
        (s: BackendSession): Session => ({
          id: s.id,
          user_id: 'demoUser',
          project_id: null,
          task_id: s.taskId ?? null,
          focus_block_id: s.plannedBlockId ?? null,
          status: s.status,
          start_time: s.startTime,
          end_time: s.endTime ?? null,
          initial_context: null,
          summary: s.summary ?? null,
          key_decisions: s.keyDecisions ?? null,
          next_steps: s.nextSteps ?? null,
          risk_flags: s.riskFlags ?? null,
          created_at: s.createdAt,
          updated_at: s.updatedAt,
          task: undefined,
          project: undefined,
        }),
      );

      setSessions(mapped);
    } catch (error: any) {
      toast({
        title: 'Error loading sessions',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filterButtons: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <FolderKanban className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Sessions</h1>
                <p className="text-muted-foreground">
                  Your session capsules with full context
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-1">
              {filterButtons.map((btn) => (
                <Button
                  key={btn.value}
                  variant={filter === btn.value ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter(btn.value)}
                  className={filter === btn.value ? 'bg-secondary' : ''}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Sessions List */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-secondary/50 mb-4">
                <FolderKanban className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Sessions Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start a focus block to create your first session capsule
              </p>
              <Button variant="glow" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session, index) => (
                <div
                  key={session.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <SessionCard session={session} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
