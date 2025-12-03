import { Router } from 'express';
import { db } from '../config/firebaseClient';
import { DayPlan, Notification, Task } from '../types/core';
import { getMentions } from '../integrations/slackMcpClient';
import { classifyInterrupt } from '../agents/interruptAgent';

const router = Router();

const DEMO_USER_ID = 'demoUser';
const NOTIFICATIONS_PATH = `notifications/${DEMO_USER_ID}`;
const NOTIFICATION_META_PATH = `notificationMeta/${DEMO_USER_ID}`;
const PLANS_PATH = `plans/${DEMO_USER_ID}`;
const LOCAL_TASKS_PATH = `tasks/${DEMO_USER_ID}/local`;

const getTodayDateString = (): string => {
  return new Date().toISOString().slice(0, 10);
};

const loadDayPlanOrEmpty = async (date: string): Promise<DayPlan> => {
  const snapshot = await db.ref(`${PLANS_PATH}/${date}`).get();
  const value = snapshot.val();

  if (!value || typeof value !== 'object') {
    const now = new Date().toISOString();
    return {
      date,
      blocks: [],
      generatedAt: now,
    };
  }

  return value as DayPlan;
};

const insertTaskIntoTodayPlan = async (task: Task): Promise<void> => {
  const today = getTodayDateString();

  try {
    const snapshot = await db.ref(`${PLANS_PATH}/${today}`).get();
    const value = snapshot.val();

    if (!value || typeof value !== 'object') {
      return;
    }

    const plan = value as DayPlan;
    const blocks = Array.isArray(plan.blocks) ? [...plan.blocks] : [];

    const now = new Date();
    const durationMinutes = 30;
    const durationMs = durationMinutes * 60 * 1000;

    const parseTime = (iso: string): number => new Date(iso).getTime();

    const sortedBlocks = blocks
      .map((b) => ({
        ...b,
        _startMs: parseTime(b.start),
        _endMs: parseTime(b.end),
      }))
      .sort((a, b) => a._startMs - b._startMs);

    let candidateStart = now.getTime();
    let candidateEnd = candidateStart + durationMs;

    for (const block of sortedBlocks) {
      if (
        Number.isNaN(block._startMs) ||
        Number.isNaN(block._endMs)
      ) {
        // Skip malformed blocks.
        // eslint-disable-next-line no-continue
        continue;
      }

      // If the candidate slot ends before this block starts, we found a gap.
      if (candidateEnd <= block._startMs) {
        break;
      }

      // If the candidate slot starts after this block ends, keep searching.
      if (candidateStart >= block._endMs) {
        // eslint-disable-next-line no-continue
        continue;
      }

      // Otherwise, there is overlap; move the candidate start to the end of this block.
      candidateStart = block._endMs;
      candidateEnd = candidateStart + durationMs;
    }

    const startIso = new Date(candidateStart).toISOString();
    const endIso = new Date(candidateEnd).toISOString();

    const newBlockId = `slack-${task.id}-${Date.now()}`;

    const newBlock = {
      id: newBlockId,
      start: startIso,
      end: endIso,
      label: task.title || 'Slack task',
      mode: 'SHALLOW' as const,
      taskIds: [task.id],
      ...(task.description ? { notes: task.description } : {}),
    };

    const updatedPlan: DayPlan = {
      ...plan,
      blocks: [...blocks, newBlock],
      generatedAt: new Date().toISOString(),
    };

    await db.ref(`${PLANS_PATH}/${today}`).set(updatedPlan);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error inserting Slack task into today plan:', err);
  }
};

const mapRawNotifications = (raw: unknown): Notification[] => {
  if (!raw || typeof raw !== 'object') return [];

  const notifications: Notification[] = [];

  Object.entries(raw as Record<string, unknown>).forEach(([id, value]) => {
    if (!value) return;
    const anyValue: any = value; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (id === '_meta') return;

    notifications.push({
      id: anyValue.id ?? id,
      userId: anyValue.userId ?? DEMO_USER_ID,
      source: anyValue.source ?? 'SLACK',
      rawText: anyValue.rawText ?? '',
      createdAt: anyValue.createdAt ?? new Date().toISOString(),
      processed: Boolean(anyValue.processed),
      interruptDecision: anyValue.interruptDecision,
    });
  });

  return notifications;
};

router.get('/notifications', async (req, res) => {
  const processedFilterRaw = req.query.processed;
  const processedFilter =
    typeof processedFilterRaw === 'string'
      ? processedFilterRaw === 'true'
      : undefined;

  try {
    const snapshot = await db.ref(NOTIFICATIONS_PATH).get();
    const raw = snapshot.val();

    const notifications = mapRawNotifications(raw);

    const filtered =
      processedFilter === undefined
        ? notifications
        : notifications.filter((n) => n.processed === processedFilter);

    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json(filtered);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching notifications:', err);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

router.post('/notifications/:id/mark-processed', async (req, res) => {
  const { id } = req.params;

  try {
    const ref = db.ref(`${NOTIFICATIONS_PATH}/${id}`);
    const snapshot = await ref.get();
    const value = snapshot.val();

    if (!value) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    await ref.update({ processed: true });

    const updatedSnapshot = await ref.get();
    const updated = updatedSnapshot.val() as Notification;

    res.json(updated);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error marking notification as processed:', err);
    res.status(500).json({ message: 'Failed to update notification' });
  }
});

router.post('/notifications/slack/poll', async (_req, res) => {
  try {
    const metaSnapshot = await db.ref(NOTIFICATION_META_PATH).get();
    const meta = (metaSnapshot.val() as { slackLastTs?: string } | null) ?? {};
    const sinceTs =
      typeof meta.slackLastTs === 'string' ? meta.slackLastTs : undefined;

    const date = getTodayDateString();
    const currentPlan = await loadDayPlanOrEmpty(date);

    const mentions = await getMentions(sinceTs);

    if (!mentions.length) {
      res.json({ created: [], lastTs: sinceTs ?? null });
      return;
    }

    const notifications: Notification[] = [];

    const makeSafeId = (raw: string): string => {
      // Firebase keys cannot contain ".", "#", "$", "[", or "]"
      return raw.replace(/[.#$/[\]]/g, '_');
    };

    for (const mention of mentions) {
      // eslint-disable-next-line no-await-in-loop
      const decision = await classifyInterrupt({
        notificationText: mention.text,
        currentPlan,
      });

      // eslint-disable-next-line no-console
      console.log('Slack interrupt decision:', {
        text: mention.text,
        priority: decision.priority,
        suggestedAction: decision.suggestedAction,
      });

      const rawId = `${mention.channelId}-${mention.ts}`;
      const id = makeSafeId(rawId);
      const createdAt = new Date().toISOString();

      if (decision.priority === 'URGENT') {
        const notification: Notification = {
          id,
          userId: DEMO_USER_ID,
          source: 'SLACK',
          rawText: mention.text,
          createdAt,
          processed: false,
          interruptDecision: decision,
        };

        // eslint-disable-next-line no-await-in-loop
        await db.ref(`${NOTIFICATIONS_PATH}/${id}`).set(notification);
        notifications.push(notification);
      } else if (decision.priority === 'LATER') {
        const notification: Notification = {
          id,
          userId: DEMO_USER_ID,
          source: 'SLACK',
          rawText: mention.text,
          createdAt,
          processed: true,
          interruptDecision: decision,
        };

        // eslint-disable-next-line no-await-in-loop
        await db.ref(`${NOTIFICATIONS_PATH}/${id}`).set(notification);

        const now = new Date();
        const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const laterDate = later.toISOString().slice(0, 10);

        // Automatically create a local task for non-urgent work,
        // scheduled for a later date.
        // eslint-disable-next-line no-await-in-loop
        await ensureLocalTaskForNotification(notification, laterDate);
      } else {
        const notification: Notification = {
          id,
          userId: DEMO_USER_ID,
          source: 'SLACK',
          rawText: mention.text,
          createdAt,
          processed: true,
          interruptDecision: decision,
        };

        // eslint-disable-next-line no-await-in-loop
        await db.ref(`${NOTIFICATIONS_PATH}/${id}`).set(notification);
      }
    }

    const lastTs = mentions
      .map((m) => m.ts)
      .filter((ts) => typeof ts === 'string' && ts.length > 0)
      .sort()
      .pop();

    if (lastTs) {
      await db.ref(NOTIFICATION_META_PATH).update({ slackLastTs: lastTs });
    }

    res.json({ created: notifications, lastTs: lastTs ?? sinceTs ?? null });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error polling Slack mentions for notifications:', err);
    res.status(500).json({ message: 'Failed to poll Slack notifications' });
  }
});

const ensureLocalTaskForNotification = async (
  notification: Notification,
  dueDate?: string,
): Promise<Task> => {
  const stripSlackMentions = (text: string | undefined): string => {
    if (!text) return '';
    return text
      .replace(/<@[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const effectiveDueDate = dueDate ?? today;

  // First, try to find an existing local task that already represents
  // this Slack notification (to avoid duplicates).
  try {
    const snapshot = await db.ref(LOCAL_TASKS_PATH).get();
    const raw = snapshot.val();

    if (raw && typeof raw === 'object') {
      const anyRaw: Record<string, any> = raw; // eslint-disable-line @typescript-eslint/no-explicit-any

      // Prefer exact description match and a "slack" label.
      const existingEntry = Object.values(anyRaw).find((item) => {
        if (!item) return false;
        const descriptionMatches =
          typeof item.description === 'string' &&
          item.description.trim() === notification.rawText.trim();
        const labels: string[] | undefined = Array.isArray(item.labels)
          ? item.labels
          : undefined;
        const hasSlackLabel =
          !!labels && labels.some((label) => label === 'slack');

        return descriptionMatches && hasSlackLabel;
      });

      if (existingEntry) {
        const anyItem: any = existingEntry; // eslint-disable-line @typescript-eslint/no-explicit-any
        const rawTitle =
          anyItem.title ??
          (notification.rawText || 'Slack task');
        const rawDescription =
          anyItem.description ?? notification.rawText;

        const existingTask: Task = {
          id: anyItem.id ?? '',
          title: stripSlackMentions(rawTitle) || 'Slack task',
          description: stripSlackMentions(rawDescription),
          source: 'LOCAL',
          labels: anyItem.labels,
          dueDate: anyItem.dueDate ?? effectiveDueDate,
        };

        return existingTask;
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error checking for existing local Slack task:', err);
  }

  const cleanedRawText = stripSlackMentions(notification.rawText);

  const baseText =
    cleanedRawText.length > 120
      ? `${cleanedRawText.slice(0, 117)}...`
      : cleanedRawText || 'Slack task';

  const title = `Slack: ${baseText}`;

  const labels: string[] = ['slack'];
  if (notification.interruptDecision?.priority) {
    labels.push(notification.interruptDecision.priority.toLowerCase());
  }

  try {
    const jiraKeyMatch = notification.rawText.match(
      /\b([A-Z][A-Z0-9]+-\d+)\b/,
    );
    if (jiraKeyMatch && jiraKeyMatch[1]) {
      labels.push(`JIRA_KEY:${jiraKeyMatch[1]}`);
    }
  } catch {
    // ignore parse errors
  }

  const idSnapshot = await db.ref(LOCAL_TASKS_PATH).push().key;
  const id = idSnapshot ?? `${Date.now()}`;

  const task: Task = {
    id,
    title,
    description: cleanedRawText,
    source: 'LOCAL',
    labels,
    dueDate: effectiveDueDate,
  };

  const taskForDb: Record<string, unknown> = {
    id: task.id,
    title: task.title,
    source: task.source,
    description: task.description,
    labels: task.labels,
    dueDate: task.dueDate,
  };

  await db.ref(`${LOCAL_TASKS_PATH}/${id}`).set(taskForDb);

  return task;
};

router.post('/notifications/:id/schedule-now', async (req, res) => {
  const { id } = req.params;

  try {
    const ref = db.ref(`${NOTIFICATIONS_PATH}/${id}`);
    const snapshot = await ref.get();
    const value = snapshot.val();

    if (!value) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    const notification = value as Notification;

    const nowDate = new Date().toISOString().slice(0, 10);
    const task = await ensureLocalTaskForNotification(notification, nowDate);

    await insertTaskIntoTodayPlan(task);

    await ref.update({ processed: true });

    res.json({ notification: { ...notification, processed: true }, task });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error scheduling notification for now:', err);
    res.status(500).json({ message: 'Failed to schedule notification' });
  }
});

router.post('/notifications/:id/schedule-later', async (req, res) => {
  const { id } = req.params;

  try {
    const ref = db.ref(`${NOTIFICATIONS_PATH}/${id}`);
    const snapshot = await ref.get();
    const value = snapshot.val();

    if (!value) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    const notification = value as Notification;

    const now = new Date();
    const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const laterDate = later.toISOString().slice(0, 10);

    const task = await ensureLocalTaskForNotification(notification, laterDate);

    await ref.update({ processed: true });

    res.json({ notification: { ...notification, processed: true }, task });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error scheduling notification for later:', err);
    res.status(500).json({ message: 'Failed to schedule notification' });
  }
});

export default router;
