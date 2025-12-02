import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/firebaseClient';
import {
  Session,
  SessionEvent,
  SessionEventType,
  Task,
  Notification,
} from '../types/core';
import {
  getAssignedIssues as getGithubAssignedIssues,
  getIssueDetails as getGithubIssueDetails,
} from '../integrations/githubMcpClient';
import {
  getAssignedJiraIssues,
  getJiraIssueDetails,
} from '../integrations/jiraMcpClient';
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
const NOTIFICATIONS_PATH = `notifications/${DEMO_USER_ID}`;

type SessionTaskSource = 'GITHUB' | 'JIRA' | 'LOCAL';

interface StartSessionPayload {
  taskId: string;
  plannedBlockId?: string;
  source?: SessionTaskSource;
}

interface SessionWithMeta extends Session {
  taskSource?: SessionTaskSource;
  riskFlags?: string;
  issueStateAtStart?: string;
  taskUrl?: string;
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

const deleteLocalTaskById = async (taskId: string): Promise<void> => {
  try {
    const snapshot = await db.ref(LOCAL_TASKS_PATH).get();
    const raw = snapshot.val();

    if (!raw || typeof raw !== 'object') return;

    const anyRaw: Record<string, any> = raw; // eslint-disable-line @typescript-eslint/no-explicit-any
    const updates: Record<string, null> = {};

    Object.entries(anyRaw).forEach(([key, item]) => {
      if (!item) return;
      if (item.id === taskId) {
        updates[key] = null;
      }
    });

    if (Object.keys(updates).length > 0) {
      await db.ref(LOCAL_TASKS_PATH).update(updates);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error deleting local task by id:', err);
  }
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

const removeLocalSlackTasksForJiraKey = async (
  jiraKey: string,
): Promise<{ id: string; title: string }[]> => {
  try {
    const snapshot = await db.ref(LOCAL_TASKS_PATH).get();
    const raw = snapshot.val();

    if (!raw || typeof raw !== 'object') return [];

    const anyRaw: Record<string, any> = raw; // eslint-disable-line @typescript-eslint/no-explicit-any
    const updates: Record<string, null> = {};
    const removed: { id: string; title: string }[] = [];

    Object.entries(anyRaw).forEach(([id, item]) => {
      if (!item) return;
      const labels: string[] | undefined = Array.isArray(item.labels)
        ? item.labels
        : undefined;
      if (!labels) return;

      const hasSlack = labels.includes('slack');
      const hasMatchingJiraKey = labels.includes(`JIRA_KEY:${jiraKey}`);

      if (hasSlack && hasMatchingJiraKey) {
        updates[id] = null;
        removed.push({
          id: item.id ?? id,
          title: item.title ?? '',
        });
      }
    });

    if (Object.keys(updates).length > 0) {
      await db.ref(LOCAL_TASKS_PATH).update(updates);
    }

    return removed;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      'Error removing local Slack tasks for Jira key:',
      err,
    );
    return [];
  }
};

const removeLocalSlackTasksForJiraContext = async (
  title: string,
  description: string,
): Promise<{ id: string; title: string }[]> => {
  try {
    const snapshot = await db.ref(LOCAL_TASKS_PATH).get();
    const raw = snapshot.val();

    if (!raw || typeof raw !== 'object') return [];

    const anyRaw: Record<string, any> = raw; // eslint-disable-line @typescript-eslint/no-explicit-any
    const updates: Record<string, null> = {};
    const removed: { id: string; title: string }[] = [];

    const normalize = (text: string): string[] => {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4);
    };

    const jiraTokens = new Set(
      normalize(`${title ?? ''} ${description ?? ''}`),
    );
    if (!jiraTokens.size) return;

    Object.entries(anyRaw).forEach(([id, item]) => {
      if (!item) return;
      const labels: string[] | undefined = Array.isArray(item.labels)
        ? item.labels
        : undefined;
      if (!labels || !labels.includes('slack')) return;

      const slackText = `${item.title ?? ''} ${item.description ?? ''}`;
      const slackTokens = normalize(slackText);

      const overlapCount = slackTokens.reduce((count, token) => {
        return jiraTokens.has(token) ? count + 1 : count;
      }, 0);

      if (overlapCount >= 2) {
        updates[id] = null;
        removed.push({
          id: item.id ?? id,
          title: item.title ?? '',
        });
      }
    });

    if (Object.keys(updates).length > 0) {
      await db.ref(LOCAL_TASKS_PATH).update(updates);
    }

    return removed;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      'Error removing local Slack tasks for Jira context:',
      err,
    );
    return [];
  }
};

const parseGithubIssueFromUrl = (
  url?: string,
): { owner: string; repo: string; issueNumber: number } | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 4) return null;
    const [owner, repo, type, num] = parts;
    if (type !== 'issues') return null;
    const issueNumber = Number.parseInt(num, 10);
    if (!owner || !repo || Number.isNaN(issueNumber)) return null;
    return { owner, repo, issueNumber };
  } catch {
    return null;
  }
};

const parseJiraIssueKeyFromUrl = (url?: string): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (!parts.length) return null;
    return parts[parts.length - 1];
  } catch {
    return null;
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

    let issueStateAtStart: string | undefined;
    try {
      if (task?.url && payload.source === 'GITHUB') {
        const parsed = parseGithubIssueFromUrl(task.url);
        if (parsed) {
          const details = await getGithubIssueDetails(
            parsed.owner,
            parsed.repo,
            parsed.issueNumber,
          );
          // GitHub issue state is usually "open" or "closed"
          issueStateAtStart = (details as any).state;
        }
      } else if (task?.url && payload.source === 'JIRA') {
        const key = parseJiraIssueKeyFromUrl(task.url);
        if (key) {
          const details = await getJiraIssueDetails(key);
          // Jira status is typically in the description we returned, so we skip for now
          // but keep the hook for future enrichment.
          if ((details as any).status) {
            issueStateAtStart = (details as any).status;
          }
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching initial issue state for session:', err);
    }

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
      ...(task?.url ? { taskUrl: task.url } : {}),
      ...(issueStateAtStart ? { issueStateAtStart } : {}),
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

    // If this session was for a Slack-derived local task, consider it
    // completed once the session ends and remove it from the local backlog.
    if (
      rawSession.taskSource === 'LOCAL' &&
      rawSession.taskId &&
      task?.labels?.includes('slack')
    ) {
      await deleteLocalTaskById(rawSession.taskId);
    }

    // Enrich with external issue details and state when possible for richer summaries.
    let issueDetails: SessionAgentInput['issueDetails'] | undefined;
    let removedSlackTasksForIssue: { id: string; title: string }[] = [];
    try {
      const effectiveUrl = task?.url ?? rawSession.taskUrl;

      if (effectiveUrl && rawSession.taskSource === 'GITHUB') {
        const parsed = parseGithubIssueFromUrl(effectiveUrl);
        if (parsed) {
          const details = await getGithubIssueDetails(
            parsed.owner,
            parsed.repo,
            parsed.issueNumber,
          );
          const stateAfter = (details as any).state as string | undefined;
          const stateBefore = rawSession.issueStateAtStart;
          const closedDuringSession =
            stateAfter === 'closed' ||
            (stateBefore === 'open' && stateAfter === 'closed');

          issueDetails = {
            source: 'GITHUB',
            title: details.title,
            description: details.body,
            url: details.url,
            stateBefore,
            stateAfter,
            closedDuringSession,
          };
          // eslint-disable-next-line no-console
          console.log(
            'Session issue state for GitHub:',
            JSON.stringify(
              { stateBefore, stateAfter, closedDuringSession },
              null,
              2,
            ),
          );
        }
      } else if (effectiveUrl && rawSession.taskSource === 'JIRA') {
        const key = parseJiraIssueKeyFromUrl(effectiveUrl);
        if (key) {
          const details = await getJiraIssueDetails(key);
          const stateAfter = (details as any).status as string | undefined;
          const stateBefore = rawSession.issueStateAtStart;

          const normalizedBefore = stateBefore?.toLowerCase();
          const normalizedAfter = stateAfter?.toLowerCase();

          const isDone = (status?: string) => {
            if (!status) return false;
            const s = status.toLowerCase();
            return (
              s.includes('done') ||
              s.includes('resolved') ||
              s.includes('closed') ||
              s.includes('complete')
            );
          };

          const closedDuringSession =
            isDone(stateAfter) ||
            (!!normalizedBefore &&
              !isDone(normalizedBefore) &&
              isDone(normalizedAfter));

          issueDetails = {
            source: 'JIRA',
            title: details.title,
            description: details.description,
            url: details.url,
            stateBefore,
            stateAfter,
            closedDuringSession,
          };

          if (closedDuringSession) {
            const removedByKey = await removeLocalSlackTasksForJiraKey(key);
            const removedByContext =
              await removeLocalSlackTasksForJiraContext(
                details.title,
                details.description,
              );

            const merged = new Map<string, string>();
            [...removedByKey, ...removedByContext].forEach((t) => {
              if (!merged.has(t.id)) {
                merged.set(t.id, t.title);
              }
            });

            removedSlackTasksForIssue = Array.from(
              merged.entries(),
            ).map(([id, title]) => ({ id, title }));

            if (removedSlackTasksForIssue.length > 0) {
              const titles = removedSlackTasksForIssue
                .map((t) => (t.title || '').trim())
                .filter(Boolean)
                .join(', ');

              const notification: Notification = {
                id: uuidv4(),
                userId: DEMO_USER_ID,
                source: 'SLACK',
                rawText:
                  titles.length > 0
                    ? `Removed Slack tasks [${titles}] because Jira issue ${key} was completed.`
                    : `Removed Slack tasks linked to Jira issue ${key} because it was completed.`,
                createdAt: new Date().toISOString(),
                processed: false,
                interruptDecision: undefined,
              };

              await db
                .ref(`${NOTIFICATIONS_PATH}/${notification.id}`)
                .set(notification);
            }
          }
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching external issue details for session:', err);
    }

    const slackSummary = await maybeFetchSlackSummary(events);

    // If the linked GitHub issue was closed during this session, synthesize
    // a SYSTEM event so the summarizer always sees concrete activity, even
    // when the user hasn't added any manual notes.
    let augmentedEvents = events;
    if (issueDetails?.closedDuringSession) {
      const syntheticEvent: SessionEvent = {
        id: `issue-closed-${sessionId}`,
        sessionId,
        type: 'SYSTEM',
        timestamp: new Date().toISOString(),
        payload: {
          kind: 'ISSUE_CLOSED',
          source: issueDetails.source,
          title: issueDetails.title,
          url: issueDetails.url,
        },
      };
      augmentedEvents = [...events, syntheticEvent];
    }

    if (removedSlackTasksForIssue.length > 0) {
      const syntheticSlackCleanup: SessionEvent = {
        id: `slack-cleanup-${sessionId}`,
        sessionId,
        type: 'SYSTEM',
        timestamp: new Date().toISOString(),
        payload: {
          kind: 'SLACK_TASKS_REMOVED_FOR_JIRA',
          tasks: removedSlackTasksForIssue,
        },
      };
      augmentedEvents = [...augmentedEvents, syntheticSlackCleanup];
    }

    const summaryInput: SessionAgentInput = {
      taskTitle: task?.title ?? 'Untitled task',
      taskDescription: task?.description,
      previousSessionSummary: rawSession.summary,
      events: augmentedEvents,
      slackSummary,
      prDiffSummary: undefined,
      issueDetails,
    };

    let summaryResult: {
      sessionSummary: string;
      keyDecisions: string[];
      nextSteps: string[];
      riskFlags?: string;
    };
    try {
      summaryResult = await summarizeSession(summaryInput);
    } catch (err) {
      // If the AI summary fails (e.g., invalid or leaked API key),
      // fall back to a minimal summary so the session can still end.
      // eslint-disable-next-line no-console
      console.error('Failed to summarize session with AI:', err);
      summaryResult = {
        sessionSummary:
          rawSession.summary ??
          'Automatic AI summary unavailable due to an error.',
        keyDecisions: rawSession.keyDecisions ?? [],
        nextSteps: rawSession.nextSteps ?? [],
        riskFlags: undefined,
      };
    }

    // Deterministically ensure issue closure is reflected in the summary.
    if (issueDetails?.closedDuringSession) {
      const closureSentence = `The linked ${issueDetails.source} issue "${issueDetails.title}" was closed during this session.`;

      if (!summaryResult.sessionSummary) {
        summaryResult.sessionSummary = closureSentence;
      } else if (!summaryResult.sessionSummary.includes(issueDetails.title)) {
        summaryResult.sessionSummary = `${summaryResult.sessionSummary} ${closureSentence}`;
      }

      if (!summaryResult.keyDecisions) summaryResult.keyDecisions = [];
      summaryResult.keyDecisions.push(
        `Closed the ${issueDetails.source} issue: ${issueDetails.title}`,
      );

      if (!summaryResult.nextSteps) summaryResult.nextSteps = [];
      summaryResult.nextSteps.push(
        'Verify the fix in staging/production and monitor for regressions.',
      );
    }

    if (removedSlackTasksForIssue.length > 0) {
      const titles = removedSlackTasksForIssue
        .map((t) => (t.title || '').trim())
        .filter(Boolean);

      if (titles.length > 0) {
        const cleanupSentence = `The following Slack-derived tasks were removed from your backlog because the linked Jira issue was completed: ${titles
          .map((t) => `"${t}"`)
          .join(', ')}.`;

        if (!summaryResult.sessionSummary) {
          summaryResult.sessionSummary = cleanupSentence;
        } else if (
          !summaryResult.sessionSummary.includes(
            'Slack-derived tasks were removed from your backlog',
          )
        ) {
          summaryResult.sessionSummary = `${summaryResult.sessionSummary} ${cleanupSentence}`;
        }

        if (!summaryResult.keyDecisions) summaryResult.keyDecisions = [];
        summaryResult.keyDecisions.push(
          `Cleaned up related Slack tasks: ${titles.join(', ')}`,
        );
      }
    }

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
