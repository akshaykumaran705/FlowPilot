import axios from 'axios';
import { Task } from '../types/core';

const MCP_BASE_URL = 'http://localhost:5001';

type RawIssue = {
  id?: string | number;
  number?: number;
  title?: string;
  body?: string;
  description?: string;
  url?: string;
  html_url?: string;
  labels?: Array<string | { name?: string }>;
  state?: string;
};

const mapLabels = (labels: RawIssue['labels']): string[] | undefined => {
  if (!labels) return undefined;

  return labels.map((label) => {
    if (typeof label === 'string') return label;
    return label.name ?? '';
  }).filter((name) => name && name.trim().length > 0);
};

const mapIssueToTask = (issue: RawIssue): Task => {
  const id =
    issue.id !== undefined
      ? String(issue.id)
      : issue.number !== undefined
      ? String(issue.number)
      : '';

  return {
    id,
    title: issue.title ?? 'Untitled issue',
    description: issue.body ?? issue.description,
    url: issue.html_url ?? issue.url,
    source: 'GITHUB',
    labels: mapLabels(issue.labels),
  };
};

export const getAssignedIssues = async (): Promise<Task[]> => {
  try {
    const response = await axios.get(`${MCP_BASE_URL}/tools/getAssignedIssues`, {
      timeout: 10000, // 10 second timeout
    });
    const data = response.data;

    const issues: RawIssue[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.issues)
      ? data.issues
      : Array.isArray(data?.items)
      ? data.items
      : [];

    return issues.map(mapIssueToTask);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('Error fetching assigned GitHub issues from MCP:', err);
    // Return empty array on error - don't break the app if MCP is down
    return [];
  }
};

export const getIssueDetails = async (
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<{ title: string; body: string; url: string; state?: string }> => {
  try {
    const response = await axios.get(
      `${MCP_BASE_URL}/tools/getIssueDetails`,
      {
        params: { owner, repo, issueNumber },
        timeout: 10000, // 10 second timeout
      },
    );

    const data: RawIssue = response.data;

    return {
      title: data.title ?? 'Untitled issue',
      body: data.body ?? data.description ?? '',
      url: data.html_url ?? data.url ?? '',
      state: data.state,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching GitHub issue details from MCP:', err);
    throw new Error('Failed to fetch GitHub issue details from MCP');
  }
};
