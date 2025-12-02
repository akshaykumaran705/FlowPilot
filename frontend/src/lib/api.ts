const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (data && typeof data.message === 'string') {
        message = data.message;
      }
    } catch {
      // ignore JSON parse errors; keep generic message
    }
    throw new Error(message);
  }

  // Some endpoints may return 204 with no body.
  if (response.status === 204) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return undefined as any;
  }

  return (await response.json()) as T;
}

// Backend task shape
export interface BackendTask {
  id: string;
  title: string;
  description?: string;
  url?: string;
  source: 'GITHUB' | 'JIRA' | 'LOCAL';
  labels?: string[];
}

export interface BackendPlanBlock {
  id: string;
  start: string;
  end: string;
  label: string;
  mode: 'DEEP_WORK' | 'SHALLOW' | 'MEETING';
  taskIds: string[];
  notes?: string;
}

export interface BackendDayPlan {
  date: string;
  blocks: BackendPlanBlock[];
  generatedAt: string;
}

export interface BackendSession {
  id: string;
  userId: string;
  projectId?: string;
  taskId?: string;
  plannedBlockId?: string;
  status: 'active' | 'completed';
  startTime: string;
  endTime?: string;
  summary?: string;
  nextSteps?: string[];
  keyDecisions?: string[];
  slackSummary?: string;
  createdAt: string;
  updatedAt: string;
  riskFlags?: string;
  taskSource?: 'GITHUB' | 'JIRA' | 'LOCAL';
}

export interface BackendSessionEvent {
  id: string;
  sessionId: string;
  type: 'NOTE' | 'TEST_RESULT' | 'SYSTEM';
  timestamp: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

export interface BackendSettings {
  githubToken?: string;
  githubTokenPlain?: string;
  slackToken?: string;
  slackTokenPlain?: string;
  timezone?: string;
  workStart?: string;
  workEnd?: string;
}

export async function getSettings(): Promise<BackendSettings> {
  return apiRequest<BackendSettings>('/settings');
}

export async function updateSettings(
  payload: Partial<Pick<BackendSettings, 'timezone' | 'workStart' | 'workEnd'>>,
): Promise<BackendSettings> {
  return apiRequest<BackendSettings>('/settings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getGithubTasks(): Promise<BackendTask[]> {
  return apiRequest<BackendTask[]>('/tasks/github');
}

export async function getJiraTasks(): Promise<BackendTask[]> {
  return apiRequest<BackendTask[]>('/tasks/jira');
}

export async function getLocalTasks(): Promise<BackendTask[]> {
  return apiRequest<BackendTask[]>('/tasks/local');
}

export async function createLocalTask(payload: {
  title: string;
  description?: string;
  labels?: string[];
}): Promise<BackendTask> {
  return apiRequest<BackendTask>('/tasks/local', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function planDay(date: string): Promise<BackendDayPlan> {
  return apiRequest<BackendDayPlan>('/plan-day', {
    method: 'POST',
    body: JSON.stringify({ date }),
  });
}

export async function getDayPlan(date: string): Promise<BackendDayPlan> {
  return apiRequest<BackendDayPlan>(`/plan-day?date=${encodeURIComponent(date)}`);
}

export async function startSession(payload: {
  taskId: string;
  plannedBlockId?: string;
  source?: 'GITHUB' | 'JIRA' | 'LOCAL';
}): Promise<BackendSession> {
  return apiRequest<BackendSession>('/session/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function addSessionEvent(payload: {
  sessionId: string;
  type: BackendSessionEvent['type'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventPayload: any;
}): Promise<BackendSessionEvent> {
  return apiRequest<BackendSessionEvent>('/session/event', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: payload.sessionId,
      type: payload.type,
      payload: payload.eventPayload,
    }),
  });
}

export async function endSession(sessionId: string): Promise<BackendSession> {
  return apiRequest<BackendSession>('/session/end', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export async function listSessions(
  status?: 'active' | 'completed',
): Promise<BackendSession[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest<BackendSession[]>(`/sessions${query}`);
}

export async function getSessionWithEvents(
  sessionId: string,
): Promise<{ session: BackendSession; events: BackendSessionEvent[] }> {
  return apiRequest<{ session: BackendSession; events: BackendSessionEvent[] }>(
    `/sessions/${encodeURIComponent(sessionId)}`,
  );
}

