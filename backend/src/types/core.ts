export type TaskSource = 'GITHUB' | 'JIRA' | 'LOCAL';

export interface Task {
  id: string;
  title: string;
  description?: string;
  url?: string;
  source: TaskSource;
  labels?: string[];
  dueDate?: string;
}

export type PlanBlockMode = 'DEEP_WORK' | 'SHALLOW' | 'MEETING';

export interface PlanBlock {
  id: string;
  start: string;
  end: string;
  label: string;
  mode: PlanBlockMode;
  taskIds: string[];
  notes?: string;
}

export interface DayPlan {
  date: string;
  blocks: PlanBlock[];
  generatedAt: string;
}

export type SessionStatus = 'active' | 'completed';

export interface Session {
  id: string;
  userId: string;
  projectId?: string;
  taskId?: string;
  plannedBlockId?: string;
  status: SessionStatus;
  startTime: string;
  endTime?: string;
  summary?: string;
  nextSteps?: string[];
  keyDecisions?: string[];
  slackSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export type SessionEventType = 'NOTE' | 'TEST_RESULT' | 'SYSTEM';

export interface SessionEvent {
  id: string;
  sessionId: string;
  type: SessionEventType;
  timestamp: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

export type NotificationSource = 'GITHUB' | 'SLACK' | 'CALENDAR' | 'JIRA';

export type InterruptPriority = 'URGENT' | 'LATER' | 'IGNORE';

export type InterruptAction =
  | 'START_NOW'
  | 'ADD_TO_EXISTING_BLOCK'
  | 'CREATE_NEW_BLOCK'
  | 'IGNORE';

export interface NotificationInterruptDecision {
  priority: InterruptPriority;
  suggestedAction: InterruptAction;
  suggestedBlockId?: string;
  rationale: string;
}

export interface Notification {
  id: string;
  userId: string;
  source: NotificationSource;
  rawText: string;
  createdAt: string;
  processed: boolean;
  interruptDecision?: NotificationInterruptDecision;
}
