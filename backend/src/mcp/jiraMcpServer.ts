import 'dotenv/config';
import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  // eslint-disable-next-line no-console
  console.warn(
    'JIRA_BASE_URL, JIRA_EMAIL, or JIRA_API_TOKEN not set. Jira MCP server will return 500 for requests.',
  );
}

const jiraApi = JIRA_BASE_URL
  ? axios.create({
      baseURL: JIRA_BASE_URL,
      auth: {
        username: JIRA_EMAIL ?? '',
        password: JIRA_API_TOKEN ?? '',
      },
      headers: {
        Accept: 'application/json',
      },
    })
  : null;

app.get('/tools/getAssignedIssues', async (_req, res) => {
  if (!jiraApi) {
    res.status(500).json({
      message:
        'JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN must be configured on the Jira MCP server',
    });
    return;
  }

  try {
    const jql =
      'assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC';

    const response = await jiraApi.post('/rest/api/3/search/jql', {
      jql,
      maxResults: 50,
      fields: ['summary', 'description', 'status', 'priority', 'duedate'],
    });

    res.json(response.data.issues ?? []);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching assigned Jira issues from API:', err);
    res
      .status(500)
      .json({ message: 'Failed to fetch assigned issues from Jira API' });
  }
});

app.get('/tools/getJiraIssueDetails', async (req, res) => {
  const { issueKey } = req.query;

  if (!jiraApi) {
    res.status(500).json({
      message:
        'JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN must be configured on the Jira MCP server',
    });
    return;
  }

  if (typeof issueKey !== 'string') {
    res.status(400).json({ message: 'issueKey is required' });
    return;
  }

  try {
    const response = await jiraApi.get(`/rest/api/3/issue/${issueKey}`);
    res.json(response.data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching Jira issue details from API:', err);
    res
      .status(500)
      .json({ message: 'Failed to fetch issue details from Jira API' });
  }
});

const PORT = 5004;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Jira MCP server listening on port ${PORT}`);
});
