import { Router } from 'express';
import { db } from '../config/firebaseClient';
import { DayPlan, Task } from '../types/core';
import { getAssignedIssues as getGithubAssignedIssues } from '../integrations/githubMcpClient';
import { getAssignedJiraIssues } from '../integrations/jiraMcpClient';
import { getDayEvents } from '../integrations/calendarMcpClient';
import { planDay, PlanningAgentInput } from '../agents/planningAgent';
import { env } from '../config/env';

const router = Router();

const DEMO_USER_ID = 'demoUser';
const SETTINGS_PATH = `settings/${DEMO_USER_ID}`;
const PLANS_PATH = `plans/${DEMO_USER_ID}`;
const LOCAL_TASKS_PATH = `tasks/${DEMO_USER_ID}/local`;

const getTodayDateString = (): string => {
  return new Date().toISOString().slice(0, 10);
};

const loadSettings = async () => {
  const snapshot = await db.ref(SETTINGS_PATH).get();
  const value = snapshot.val() ?? {};

  const timezone: string = value.timezone || env.defaultTimezone;
  const workStart: string = value.workStart || env.defaultWorkStart;
  const workEnd: string = value.workEnd || env.defaultWorkEnd;

  return { timezone, workStart, workEnd };
};

const loadLocalTasks = async (): Promise<Task[]> => {
  try {
    const snapshot = await db.ref(LOCAL_TASKS_PATH).get();
    const raw = snapshot.val();

    if (!raw) return [];

    const tasks: Task[] = [];

    if (Array.isArray(raw)) {
      raw.forEach((item, index) => {
        if (!item) return;
        const id = item.id ?? String(index);
        tasks.push({
          id,
          title: item.title ?? 'Untitled task',
          description: item.description,
          url: item.url,
          source: 'LOCAL',
          labels: item.labels,
        });
      });
    } else if (typeof raw === 'object') {
      Object.entries(raw).forEach(([id, item]) => {
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
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error loading local tasks:', err);
    return [];
  }
};

router.post('/plan-day', async (req, res) => {
  const requestedDate = (req.body?.date as string | undefined) || undefined;
  const date = requestedDate || getTodayDateString();

  try {
    const [{ timezone, workStart, workEnd }, githubTasks, jiraTasks, localTasks, events] =
      await Promise.all([
        loadSettings(),
        getGithubAssignedIssues(),
        getAssignedJiraIssues(),
        loadLocalTasks(),
        getDayEvents(date, undefined as unknown as string),
      ]);

    const effectiveTimezone = timezone || env.defaultTimezone;

    const planningInput: PlanningAgentInput = {
      date,
      timezone: effectiveTimezone,
      workStart: workStart || env.defaultWorkStart,
      workEnd: workEnd || env.defaultWorkEnd,
      tasks: [...githubTasks, ...jiraTasks, ...localTasks],
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        type: event.type,
        description: event.description,
      })),
    };

    const plan: DayPlan = await planDay(planningInput);

    // Override meeting block labels/notes with raw calendar event titles/descriptions.
    if (Array.isArray(plan.blocks) && planningInput.events.length > 0) {
      const eventsSorted = [...planningInput.events].sort((a, b) => {
        const aTime = new Date(a.start).getTime();
        const bTime = new Date(b.start).getTime();
        return aTime - bTime;
      });

      plan.blocks = plan.blocks.map((block) => {
        if (!block || block.mode !== 'MEETING' || !eventsSorted.length) {
          return block;
        }

        const blockStart = new Date(block.start).getTime();
        if (Number.isNaN(blockStart)) {
          return block;
        }

        let bestEvent = eventsSorted[0];
        let bestDiff = Math.abs(
          new Date(bestEvent.start).getTime() - blockStart,
        );

        for (let i = 1; i < eventsSorted.length; i += 1) {
          const e = eventsSorted[i];
          const eStart = new Date(e.start).getTime();
          if (Number.isNaN(eStart)) continue;
          const diff = Math.abs(eStart - blockStart);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestEvent = e;
          }
        }

        const updated = { ...block };
        if (bestEvent.title) {
          updated.label = bestEvent.title;
        }
        if (!updated.notes && bestEvent.description) {
          updated.notes = bestEvent.description;
        }
        return updated;
      });
    }

    await db.ref(`${PLANS_PATH}/${date}`).set(plan);

    res.json(plan);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error generating day plan:', err);
    res.status(500).json({ message: 'Failed to generate day plan' });
  }
});

router.get('/plan-day', async (req, res) => {
  const requestedDate = (req.query.date as string | undefined) || undefined;
  const date = requestedDate || getTodayDateString();

  try {
    const snapshot = await db.ref(`${PLANS_PATH}/${date}`).get();
    const value = snapshot.val();

    if (!value) {
      res.status(404).json({ message: 'No plan found for this date' });
      return;
    }

    res.json(value);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching day plan:', err);
    res.status(500).json({ message: 'Failed to fetch day plan' });
  }
});

export default router;
