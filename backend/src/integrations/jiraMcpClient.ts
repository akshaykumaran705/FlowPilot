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

// Helper to extract text from Jira's doc format (Atlassian Document Format)
const extractTextFromJiraDoc = (doc: any): string => {
  if (!doc) return '';
  if (typeof doc === 'string') return doc;
  if (typeof doc !== 'object') return String(doc);

  // Handle Atlassian Document Format
  if (doc.type === 'doc' && Array.isArray(doc.content)) {
    const extractText = (node: any): string => {
      if (typeof node === 'string') return node;
      if (!node || typeof node !== 'object') return '';

      if (node.type === 'text' && typeof node.text === 'string') {
        return node.text;
      }

      if (Array.isArray(node.content)) {
        return node.content.map(extractText).join(' ');
      }

      return '';
    };

    return doc.content.map(extractText).join(' ').trim();
  }

  return '';
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

  // Handle description which can be string, object (doc format), or undefined
  let description: string | undefined;
  if (issue.fields?.description !== undefined) {
    description = extractTextFromJiraDoc(issue.fields.description);
  } else if (issue.description !== undefined) {
    description = extractTextFromJiraDoc(issue.description);
  }

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
      {
        timeout: 10000, // 10 second timeout
      },
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
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('Error fetching assigned Jira issues from MCP:', err);
    // Return empty array on error - don't break the app if MCP is down
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
        timeout: 10000, // 10 second timeout
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
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('Error fetching Jira issue details from MCP:', err);
    
    // Provide more specific error messages
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      throw new Error('Jira MCP server is unavailable. Please check if it is running.');
    }
    if (err.response?.status === 404) {
      throw new Error(`Jira issue ${issueKey} not found. It may have been deleted.`);
    }
    
    throw new Error(`Failed to fetch Jira issue details: ${err.message || 'Unknown error'}`);
  }
};
