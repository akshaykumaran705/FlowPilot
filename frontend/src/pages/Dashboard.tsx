import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { PlanMyDayModal } from '@/components/dashboard/PlanMyDayModal';
import { TimelineView } from '@/components/dashboard/TimelineView';
import { TaskList } from '@/components/tasks/TaskList';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { useToast } from '@/hooks/use-toast';
import { Task, DayPlan, FocusBlock } from '@/types/flowpilot';
import {
  createLocalTask,
  startSession,
  getDayPlan,
  getGithubTasks,
  getLocalTasks,
  planDay,
  updateSettings,
} from '@/lib/api';
import {
  Sparkles,
  Plus,
  CalendarDays,
  ListTodo,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [planningLoading, setPlanningLoading] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [todayPlan, setTodayPlan] = useState<DayPlan | null>(null);
  const [focusBlocks, setFocusBlocks] = useState<FocusBlock[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoadingData(true);

    try {
      // Load tasks from backend (GitHub + local)
      const [githubTasks, localTasks] = await Promise.all([
        getGithubTasks(),
        getLocalTasks(),
      ]);

      const allBackendTasks = [...githubTasks, ...localTasks];

      const mappedTasks: Task[] = allBackendTasks.map((t) => ({
        id: t.id,
        user_id: user.id,
        project_id: null,
        external_id: null,
        source: t.source === 'GITHUB' ? 'github' : 'manual',
        title: t.title,
        description: t.description ?? null,
        url: t.url ?? null,
        labels: t.labels ?? null,
        estimated_complexity: 'medium',
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      setTasks(mappedTasks);

      // Load today's plan from backend
      const today = format(new Date(), 'yyyy-MM-dd');

      try {
        const backendPlan = await getDayPlan(today);

        const mappedPlan: DayPlan = {
          id: backendPlan.date,
          user_id: user.id,
          plan_date: backendPlan.date,
          work_start: '09:00',
          work_end: '17:00',
          timezone: 'America/New_York',
          created_at: backendPlan.generatedAt,
        };

        setTodayPlan(mappedPlan);

        const blocks: FocusBlock[] = backendPlan.blocks
          .map((b, index) => ({
            id: b.id || `block-${index}`,
            day_plan_id: backendPlan.date,
            label: b.label,
            start_time: b.start,
            end_time: b.end,
            mode: b.mode === 'DEEP_WORK' ? 'DEEP_WORK' : 'SHALLOW',
            notes: b.notes ?? null,
            task_ids: b.taskIds ?? [],
            created_at: backendPlan.generatedAt,
          }));

        setFocusBlocks(blocks);
      } catch (err: any) {
        // 404 or other error: treat as no plan for today
        setTodayPlan(null);
        setFocusBlocks([]);
      }
    } catch (error: any) {
      toast({
        title: 'Error loading data',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handlePlanDay = async (data: { workStart: string; workEnd: string; timezone: string }) => {
    if (!user) return;
    setPlanningLoading(true);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Update backend settings so planning uses the desired hours & timezone
      await updateSettings({
        workStart: data.workStart,
        workEnd: data.workEnd,
        timezone: data.timezone,
      });

      await planDay(today);

      toast({
        title: 'Day planned!',
        description: 'Your focus blocks have been generated.',
      });

      setPlanModalOpen(false);
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Planning failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setPlanningLoading(false);
    }
  };

  const handleAddTask = async (task: { title: string; description: string; estimated_complexity: 'low' | 'medium' | 'high' }) => {
    if (!user) return;
    setAddingTask(true);

    try {
      await createLocalTask({
        title: task.title,
        description: task.description,
        labels: [task.estimated_complexity],
      });

      toast({
        title: 'Task added',
        description: 'Your task has been added to the backlog.',
      });

      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error adding task',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setAddingTask(false);
    }
  };

  const handleStartSession = async (taskId: string) => {
    if (!user) return;

    try {
      // For now, treat all tasks as LOCAL when starting sessions.
      const session = await startSession({
        taskId,
        source: 'LOCAL',
      });

      navigate(`/session/${session.id}`);
    } catch (error: any) {
      toast({
        title: 'Error starting session',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const today = format(new Date(), 'EEEE, MMMM d');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-1">{today}</h1>
              <p className="text-muted-foreground">
                {todayPlan 
                  ? `${focusBlocks.length} focus blocks planned`
                  : 'No plan yet - let AI organize your day'}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={loadData} disabled={loadingData}>
                <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="glow" onClick={() => setPlanModalOpen(true)}>
                <Sparkles className="h-4 w-4" />
                Plan My Day
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Timeline Section */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Today's Schedule</h2>
              </div>
              
              {loadingData ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <TimelineView
                  blocks={focusBlocks}
                  tasks={tasks}
                  onStartSession={handleStartSession}
                />
              )}
            </div>

            {/* Tasks Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ListTodo className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Tasks</h2>
                </div>
                <Button variant="outline" size="sm" onClick={() => setAddTaskOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              
              <div className="glass-card rounded-xl p-4 border border-border/50">
                {loadingData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <TaskList
                    tasks={tasks}
                    onStartSession={handleStartSession}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <PlanMyDayModal
        open={planModalOpen}
        onOpenChange={setPlanModalOpen}
        onSubmit={handlePlanDay}
        loading={planningLoading}
      />

      <AddTaskDialog
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        onSubmit={handleAddTask}
        loading={addingTask}
      />
    </div>
  );
}
