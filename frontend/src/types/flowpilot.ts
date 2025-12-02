export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  timezone: string;
  work_start_time: string;
  work_end_time: string;
  github_username: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  github_repo: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  external_id: string | null;
  source: 'manual' | 'github';
  title: string;
  description: string | null;
  url: string | null;
  labels: string[] | null;
  estimated_complexity: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface DayPlan {
  id: string;
  user_id: string;
  plan_date: string;
  work_start: string;
  work_end: string;
  timezone: string;
  created_at: string;
}

export interface FocusBlock {
  id: string;
  day_plan_id: string;
  label: string;
  start_time: string;
  end_time: string;
  mode: 'DEEP_WORK' | 'SHALLOW';
  notes: string | null;
  task_ids: string[] | null;
  created_at: string;
  tasks?: Task[];
}

export interface Session {
  id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  focus_block_id: string | null;
  status: 'active' | 'paused' | 'completed';
  start_time: string;
  end_time: string | null;
  initial_context: string | null;
  summary: string | null;
  key_decisions: string[] | null;
  next_steps: string[] | null;
  risk_flags: string | null;
  created_at: string;
  updated_at: string;
  task?: Task;
  project?: Project;
}

export interface SessionEvent {
  id: string;
  session_id: string;
  event_type: 'NOTE' | 'TEST_RESULT' | 'GIT_DIFF' | 'SYSTEM';
  payload: Record<string, unknown>;
  created_at: string;
}

export interface PlanningAgentInput {
  tasks: Array<{
    id: string;
    title: string;
    source: string;
    estimatedComplexity: 'low' | 'medium' | 'high';
  }>;
  workStart: string;
  workEnd: string;
  timezone: string;
}

export interface PlanningAgentOutput {
  date: string;
  blocks: Array<{
    id: string;
    start: string;
    end: string;
    label: string;
    taskIds: string[];
    mode: 'DEEP_WORK' | 'SHALLOW';
    notes: string;
  }>;
}

export interface SessionAgentInput {
  taskSummary: string;
  previousSessionSummary?: string;
  events: Array<{
    type: string;
    timestamp: string;
    payload: Record<string, unknown>;
  }>;
}

export interface SessionAgentOutput {
  sessionSummary: string;
  keyDecisions: string[];
  nextSteps: string[];
  riskFlags?: string;
}
