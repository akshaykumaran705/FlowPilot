import axios from 'axios';
import { Task } from '../types/core';

const MCP_BASE_URL = 'http://localhost:5004';

type RawJiraIssue = {
  id?: string | number;
  key?: string;
  url?: string;
  self?: string;
  browserUrl?: string;
  dueDate?: string;
  duedate?: string;
  fields?: {
    summary?: string;
    description?: string;
    duedate?: string;
    dueDate?: string;
    status?: {
      name?: string;
    };
  };
  title?: string;
  description?: string;
};

const mapJiraIssueToTask = (issue: RawJiraIssue): Task => {
  const id =
    issue.key ??
    (issue.id !== undefined ? String(issue.id) : undefined) ??
    '';

  const title =
    issue.fields?.summary ??
    issue.title ??
    'Untitled Jira issue';

  const description =
    issue.fields?.description ??
    issue.description;

  const url =
    issue.url ??
    issue.browserUrl ??
    issue.self;

  const dueDate =
    issue.fields?.duedate ??
    issue.fields?.dueDate ??
    issue.dueDate ??
    issue.duedate;

  const labels: string[] = [];
  if (issue.key) {
    labels.push(`JIRA_KEY:${issue.key}`);
  }

  return {
    id,
    title,
    description,
    url,
    source: 'JIRA',
    ...(labels.length ? { labels } : {}),
    ...(dueDate ? { dueDate } : {}),
  };
};

export const getAssignedJiraIssues = async (): Promise<Task[]> => {
  try {
    const response = await axios.get(
      `${MCP_BASE_URL}/tools/getAssignedIssues`,
    );
    const data = response.data;

    const issues: RawJiraIssue[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.issues)
      ? data.issues
      : Array.isArray(data?.items)
      ? data.items
      : [];

    return issues.map(mapJiraIssueToTask);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching assigned Jira issues from MCP:', err);
    return [];
  }
};

export const getJiraIssueDetails = async (
  issueKey: string,
): Promise<{ title: string; description: string; url: string; status?: string }> => {
  try {
    const response = await axios.get(
      `${MCP_BASE_URL}/tools/getJiraIssueDetails`,
      {
        params: { issueKey },
      },
    );

    const data: RawJiraIssue = response.data;
    const task = mapJiraIssueToTask(data);

    const status =
      data.fields?.status?.name ??
      // Fallbacks for slightly different shapes
      (data as any).status?.name ??
      (data as any).status;

    return {
      title: task.title,
      description: task.description ?? '',
      url: task.url ?? '',
      ...(status ? { status: String(status) } : {}),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching Jira issue details from MCP:', err);
    throw new Error('Failed to fetch Jira issue details from MCP');
  }
};
