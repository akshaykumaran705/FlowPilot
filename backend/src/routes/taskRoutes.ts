import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/firebaseClient';
import { Task } from '../types/core';
import { getAssignedIssues as getGithubAssignedIssues } from '../integrations/githubMcpClient';
import { getAssignedJiraIssues } from '../integrations/jiraMcpClient';

const router = Router();

const DEMO_USER_ID = 'demoUser';
const LOCAL_TASKS_PATH = `tasks/${DEMO_USER_ID}/local`;

interface NewLocalTaskPayload {
  title: string;
  description?: string;
  url?: string;
  labels?: string[];
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
        dueDate: anyItem.dueDate,
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
        dueDate: anyItem.dueDate,
      });
    });
  }

  return tasks;
};

router.get('/tasks/github', async (_req, res) => {
  try {
    const tasks = await getGithubAssignedIssues();
    res.json(tasks);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching GitHub tasks:', err);
    res.status(500).json({ message: 'Failed to fetch GitHub tasks' });
  }
});

router.get('/tasks/jira', async (_req, res) => {
  try {
    const tasks = await getAssignedJiraIssues();
    res.json(tasks);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching Jira tasks:', err);
    res.status(500).json({ message: 'Failed to fetch Jira tasks' });
  }
});

router.get('/tasks/local', async (_req, res) => {
  try {
    const snapshot = await db.ref(LOCAL_TASKS_PATH).get();
    const raw = snapshot.val();
    const tasks = mapRawLocalTasks(raw);
    res.json(tasks);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching local tasks:', err);
    res.status(500).json({ message: 'Failed to fetch local tasks' });
  }
});

router.post('/tasks/local', async (req, res) => {
  const payload = req.body as NewLocalTaskPayload;

  if (!payload.title || typeof payload.title !== 'string') {
    res.status(400).json({ message: 'Title is required for a local task' });
    return;
  }

  const id = uuidv4();

  const task: Task = {
    id,
    title: payload.title,
    description: payload.description,
    url: payload.url,
    source: 'LOCAL',
    labels: payload.labels,
  };

  try {
    const taskForDb: Record<string, unknown> = {
      id: task.id,
      title: task.title,
      source: task.source,
    };

    if (task.description !== undefined) {
      taskForDb.description = task.description;
    }
    if (task.url !== undefined) {
      taskForDb.url = task.url;
    }
    if (task.labels !== undefined) {
      taskForDb.labels = task.labels;
    }
    if ((task as any).dueDate !== undefined) {
      taskForDb.dueDate = (task as any).dueDate;
    }

    await db.ref(`${LOCAL_TASKS_PATH}/${id}`).set(taskForDb);
    res.status(201).json(task);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error creating local task:', err);
    res.status(500).json({ message: 'Failed to create local task' });
  }
});

export default router;
