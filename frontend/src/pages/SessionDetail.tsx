import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Session, SessionEvent, Task } from '@/types/flowpilot';
import {
  addSessionEvent,
  endSession,
  getSessionWithEvents,
  BackendSession,
  BackendSessionEvent,
} from '@/lib/api';
import {
  Loader2,
  ArrowLeft,
  Play,
  Square,
  Clock,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Plus,
  Terminal,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export default function SessionDetail() {
  const { sessionId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [endingSession, setEndingSession] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && sessionId) {
      loadSession();
    }
  }, [user, sessionId]);

  const mapBackendSession = (s: BackendSession): Session => ({
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
  });

  const mapBackendEvent = (e: BackendSessionEvent): SessionEvent => ({
    id: e.id,
    session_id: e.sessionId,
    event_type: e.type as SessionEvent['event_type'],
    payload: e.payload ?? {},
    created_at: e.timestamp,
  });

  const loadSession = async () => {
    if (!user || !sessionId) return;
    setLoading(true);

    try {
      const { session: backendSession, events: backendEvents } =
        await getSessionWithEvents(sessionId);

      setSession(mapBackendSession(backendSession));
      setEvents(backendEvents.map(mapBackendEvent));
    } catch (error: any) {
      toast({
        title: 'Error loading session',
        description: error.message,
        variant: 'destructive',
      });
      navigate('/sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!sessionId || !noteText.trim()) return;
    setAddingNote(true);

    try {
      await addSessionEvent({
        sessionId,
        type: 'NOTE',
        eventPayload: { text: noteText },
      });

      setNoteText('');
      await loadSession();
      
      toast({
        title: 'Note added',
        description: 'Your note has been saved to the session.',
      });
    } catch (error: any) {
      toast({
        title: 'Error adding note',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setAddingNote(false);
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;
    setEndingSession(true);

    try {
      await endSession(sessionId);

      toast({
        title: 'Session ended',
        description: 'AI has summarized your session.',
      });

      await loadSession();
    } catch (error: any) {
      toast({
        title: 'Error ending session',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setEndingSession(false);
    }
  };

  if (authLoading || loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const task = session.task as Task | undefined;
  const isActive = session.status === 'active';

  const getDuration = () => {
    const start = new Date(session.start_time);
    const end = session.end_time ? new Date(session.end_time) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <Button
            variant="ghost"
            className="mb-6"
            onClick={() => navigate('/sessions')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sessions
          </Button>

          {/* Session Header */}
          <div className="glass-card rounded-2xl p-6 mb-6 border border-border/50">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {isActive ? (
                    <Badge className="active-badge">
                      <span className="mr-1 h-2 w-2 rounded-full bg-current animate-pulse" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {getDuration()}
                  </span>
                </div>
                <h1 className="text-2xl font-bold mb-2">
                  {task?.title || 'Session Capsule'}
                </h1>
                <p className="text-muted-foreground">
                  Started {formatDistanceToNow(new Date(session.start_time), { addSuffix: true })}
                </p>
              </div>

              {isActive && (
                <Button
                  variant="destructive"
                  onClick={handleEndSession}
                  disabled={endingSession}
                >
                  {endingSession ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Square className="h-4 w-4" />
                      End Session
                    </>
                  )}
                </Button>
              )}
            </div>

            {task?.description && (
              <div className="bg-secondary/50 rounded-lg p-4 mt-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Task Description</h3>
                <p className="text-sm">{task.description}</p>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column: Events & Notes */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Session Events
              </h2>

              {/* Add Note */}
              {isActive && (
                <div className="glass-card rounded-xl p-4 mb-4 border border-border/50">
                  <Textarea
                    placeholder="Add a note, decision, or insight..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="bg-secondary/50 mb-3 min-h-[80px]"
                  />
                  <Button
                    onClick={handleAddNote}
                    disabled={addingNote || !noteText.trim()}
                    className="w-full"
                  >
                    {addingNote ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Add Note
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Events List */}
              <div className="space-y-3">
                {events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No events recorded yet
                  </div>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="glass-card rounded-lg p-4 border border-border/50"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {event.event_type === 'NOTE' && (
                          <FileText className="h-4 w-4 text-primary" />
                        )}
                        {event.event_type === 'TEST_RESULT' && (
                          <Terminal className="h-4 w-4 text-warning" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.created_at), 'h:mm a')}
                        </span>
                      </div>
                      <p className="text-sm">
                        {event.event_type === 'NOTE' && (event.payload as any).text}
                        {event.event_type === 'TEST_RESULT' && (
                          <code className="font-mono text-xs">
                            {JSON.stringify(event.payload)}
                          </code>
                        )}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: AI Summary */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                AI Summary
              </h2>

              {session.summary ? (
                <div className="space-y-4">
                  <div className="glass-card rounded-xl p-4 border border-border/50">
                    <h3 className="font-medium mb-2">Summary</h3>
                    <p className="text-sm text-secondary-foreground">
                      {session.summary}
                    </p>
                  </div>

                  {session.key_decisions && session.key_decisions.length > 0 && (
                    <div className="glass-card rounded-xl p-4 border border-border/50">
                      <h3 className="font-medium mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        Key Decisions
                      </h3>
                      <ul className="space-y-2">
                        {session.key_decisions.map((decision, i) => (
                          <li key={i} className="text-sm text-secondary-foreground flex gap-2">
                            <span className="text-muted-foreground">•</span>
                            {decision}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {session.next_steps && session.next_steps.length > 0 && (
                    <div className="glass-card rounded-xl p-4 border border-primary/30 bg-primary/5">
                      <h3 className="font-medium mb-2 flex items-center gap-2">
                        <Play className="h-4 w-4 text-primary" />
                        Next Steps
                      </h3>
                      <ul className="space-y-2">
                        {session.next_steps.map((step, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <span className="text-primary font-mono">{i + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {session.risk_flags && (
                    <div className="glass-card rounded-xl p-4 border border-warning/30 bg-warning/5">
                      <h3 className="font-medium mb-2 flex items-center gap-2 text-warning">
                        <AlertTriangle className="h-4 w-4" />
                        Risk Flags
                      </h3>
                      <p className="text-sm">{session.risk_flags}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="glass-card rounded-xl p-8 border border-border/50 text-center">
                  <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    {isActive
                      ? 'End the session to generate an AI summary'
                      : 'No summary available'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
