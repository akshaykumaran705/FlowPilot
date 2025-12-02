import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/firebaseClient';
import {
  Session,
  SessionEvent,
  SessionEventType,
  Task,
} from '../types/core';
import {
  getAssignedIssues as getGithubAssignedIssues,
} from '../integrations/githubMcpClient';
import { getAssignedJiraIssues } from '../integrations/jiraMcpClient';
import { getThreadSummary } from '../integrations/slackMcpClient';
import {
  summarizeSession,
  SessionAgentInput,
} from '../agents/sessionAgent';

const router = Router();

const DEMO_USER_ID = 'demoUser';
const SESSIONS_PATH = `sessions/${DEMO_USER_ID}`;
const EVENTS_PATH = 'events';
const LOCAL_TASKS_PATH = `tasks/${DEMO_USER_ID}/local`;

type SessionTaskSource = 'GITHUB' | 'JIRA' | 'LOCAL';

interface StartSessionPayload {
  taskId: string;
  plannedBlockId?: string;
  source?: SessionTaskSource;
}

interface SessionWithMeta extends Session {
  taskSource?: SessionTaskSource;
  riskFlags?: string;
}

const mapRawLocalTasks = (raw: unknown): Task[] => {
  if (!raw) return [];

  const tasks: Task[] = [];

  if (Array.isArray(raw)) {
    raw.forEach((item, index) => {
      if (!item) return;
      const anyItem: any = item; // eslint-disable-line @typescript-eslint/no-explicit-any
      const id = anyItem.id ?? String(index);
      tasks.push({
        id,
        title: anyItem.title ?? 'Untitled task',
        description: anyItem.description,
        url: anyItem.url,
        source: 'LOCAL',
        labels: anyItem.labels,
      });
    });
  } else if (typeof raw === 'object') {
    Object.entries(raw as Record<string, unknown>).forEach(([id, item]) => {
      if (!item) return;
      const anyItem: any = item; // eslint-disable-line @typescript-eslint/no-explicit-any
      tasks.push({
        id: anyItem.id ?? id,
        title: anyItem.title ?? 'Untitled task',
        description: anyItem.description,
        url: anyItem.url,
        source: 'LOCAL',
        labels: anyItem.labels,
      });
    });
  }

  return tasks;
};

const loadLocalTaskById = async (taskId: string): Promise<Task | undefined> => {
  const snapshot = await db.ref(LOCAL_TASKS_PATH).get();
  const raw = snapshot.val();
  const tasks = mapRawLocalTasks(raw);
  return tasks.find((t) => t.id === taskId);
};

const loadTaskForSession = async (
  taskId: string,
  source?: SessionTaskSource,
): Promise<Task | undefined> => {
  if (!taskId) return undefined;

  try {
    if (source === 'GITHUB') {
      const tasks = await getGithubAssignedIssues();
      return tasks.find((t) => t.id === taskId);
    }

    if (source === 'JIRA') {
      const tasks = await getAssignedJiraIssues();
      return tasks.find((t) => t.id === taskId);
    }

    // Default / LOCAL
    return loadLocalTaskById(taskId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error loading task for session:', err);
    return undefined;
  }
};

const mapRawEvents = (raw: unknown, sessionId: string): SessionEvent[] => {
  if (!raw || typeof raw !== 'object') return [];

  const events: SessionEvent[] = [];

  Object.entries(raw as Record<string, unknown>).forEach(([id, value]) => {
    if (!value) return;
    const anyValue: any = value; // eslint-disable-line @typescript-eslint/no-explicit-any
    const type: SessionEventType = anyValue.type;

    if (!type) return;

    events.push({
      id: anyValue.id ?? id,
      sessionId,
      type,
      timestamp: anyValue.timestamp ?? new Date().toISOString(),
      payload: anyValue.payload,
    });
  });

  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
};

const maybeFetchSlackSummary = async (
  events: SessionEvent[],
): Promise<string | undefined> => {
  const slackEvent = events.find((event) => {
    if (!event.payload || typeof event.payload !== 'object') return false;
    const payload: any = event.payload; // eslint-disable-line @typescript-eslint/no-explicit-any
    return (
      typeof payload.channelId === 'string' &&
      typeof payload.threadTs === 'string'
    );
  });

  if (!slackEvent) return undefined;

  try {
    const payload: any = slackEvent.payload; // eslint-disable-line @typescript-eslint/no-explicit-any
    const summary = await getThreadSummary(payload.channelId, payload.threadTs);
    return summary || undefined;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching Slack thread summary:', err);
    return undefined;
  }
};

router.post('/session/start', async (req, res) => {
  const payload = req.body as StartSessionPayload;

  if (!payload.taskId) {
    res.status(400).json({ message: 'taskId is required' });
    return;
  }

  const sessionId = uuidv4();
  const now = new Date().toISOString();

  try {
    const task =
      (await loadTaskForSession(payload.taskId, payload.source)) ?? undefined;

    const session: SessionWithMeta = {
      id: sessionId,
      userId: DEMO_USER_ID,
      taskId: payload.taskId,
      status: 'active',
      startTime: now,
      createdAt: now,
      updatedAt: now,
      ...(payload.plannedBlockId
        ? { plannedBlockId: payload.plannedBlockId }
        : {}),
      ...(payload.source ? { taskSource: payload.source } : {}),
      ...(task?.title ? { summary: `Working on: ${task.title}` } : {}),
    };

    await db.ref(`${SESSIONS_PATH}/${sessionId}`).set(session);

    res.status(201).json(session);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error starting session:', err);
    res.status(500).json({ message: 'Failed to start session' });
  }
});

router.post('/session/event', async (req, res) => {
  const { sessionId, type, payload } = req.body as {
    sessionId?: string;
    type?: SessionEventType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any;
  };

  if (!sessionId) {
    res.status(400).json({ message: 'sessionId is required' });
    return;
  }

  if (!type) {
    res.status(400).json({ message: 'type is required' });
    return;
  }

  const eventId = uuidv4();
  const timestamp = new Date().toISOString();

  const event: SessionEvent = {
    id: eventId,
    sessionId,
    type,
    timestamp,
    payload: payload ?? {},
  };

  try {
    await db.ref(`${EVENTS_PATH}/${sessionId}/${eventId}`).set(event);
    res.status(201).json(event);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error recording session event:', err);
    res.status(500).json({ message: 'Failed to record session event' });
  }
});

router.post('/session/end', async (req, res) => {
  const { sessionId } = req.body as { sessionId?: string };

  if (!sessionId) {
    res.status(400).json({ message: 'sessionId is required' });
    return;
  }

  try {
    const sessionSnapshot = await db
      .ref(`${SESSIONS_PATH}/${sessionId}`)
      .get();
    const rawSession = sessionSnapshot.val() as SessionWithMeta | null;

    if (!rawSession) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    const eventsSnapshot = await db
      .ref(`${EVENTS_PATH}/${sessionId}`)
      .get();
    const rawEvents = eventsSnapshot.val();
    const events = mapRawEvents(rawEvents, sessionId);

    const task =
      (rawSession.taskId &&
        (await loadTaskForSession(rawSession.taskId, rawSession.taskSource))) ||
      undefined;

    const slackSummary = await maybeFetchSlackSummary(events);

    const summaryInput: SessionAgentInput = {
      taskTitle: task?.title ?? 'Untitled task',
      taskDescription: task?.description,
      previousSessionSummary: rawSession.summary,
      events,
      slackSummary,
      prDiffSummary: undefined,
    };

    const summaryResult = await summarizeSession(summaryInput);

    const now = new Date().toISOString();

    const updatedSession: SessionWithMeta = {
      ...rawSession,
      status: 'completed',
      endTime: now,
      summary: summaryResult.sessionSummary ?? rawSession.summary,
      nextSteps: summaryResult.nextSteps ?? rawSession.nextSteps,
      keyDecisions: summaryResult.keyDecisions ?? rawSession.keyDecisions,
      updatedAt: now,
      ...(slackSummary ?? rawSession.slackSummary
        ? { slackSummary: slackSummary ?? rawSession.slackSummary }
        : {}),
      ...(summaryResult.riskFlags ? { riskFlags: summaryResult.riskFlags } : {}),
    };

    await db.ref(`${SESSIONS_PATH}/${sessionId}`).set(updatedSession);

    res.json(updatedSession);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error ending session:', err);
    res.status(500).json({ message: 'Failed to end session' });
  }
});

router.get('/sessions', async (req, res) => {
  const statusFilter = req.query.status as Session['status'] | undefined;

  try {
    const snapshot = await db.ref(SESSIONS_PATH).get();
    const raw = snapshot.val();

    if (!raw || typeof raw !== 'object') {
      res.json([]);
      return;
    }

    const sessions: SessionWithMeta[] = Object.values(
      raw as Record<string, SessionWithMeta>,
    );

    const filtered = statusFilter
      ? sessions.filter((s) => s.status === statusFilter)
      : sessions;

    res.json(filtered);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching sessions:', err);
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
});

router.get('/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const sessionSnapshot = await db
      .ref(`${SESSIONS_PATH}/${sessionId}`)
      .get();
    const session = sessionSnapshot.val() as SessionWithMeta | null;

    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    const eventsSnapshot = await db
      .ref(`${EVENTS_PATH}/${sessionId}`)
      .get();
    const rawEvents = eventsSnapshot.val();
    const events = mapRawEvents(rawEvents, sessionId);

    res.json({ session, events });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching session details:', err);
    res.status(500).json({ message: 'Failed to fetch session details' });
  }
});

export default router;
