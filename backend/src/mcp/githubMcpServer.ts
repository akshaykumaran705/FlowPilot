import 'dotenv/config';
import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  // eslint-disable-next-line no-console
  console.warn(
    'GITHUB_TOKEN is not set. GitHub MCP server will return 500 for requests.',
  );
}

const githubApi = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
    'User-Agent': 'flowpilot-mcp-github',
    Accept: 'application/vnd.github+json',
  },
});

app.get('/tools/getAssignedIssues', async (_req, res) => {
  if (!GITHUB_TOKEN) {
    res
      .status(500)
      .json({ message: 'GITHUB_TOKEN is not configured on the MCP server' });
    return;
  }

  try {
    // Issues assigned to the authenticated user across repositories.
    const response = await githubApi.get('/issues', {
      params: {
        filter: 'assigned',
        state: 'open',
        per_page: 50,
      },
    });

    res.json(response.data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching assigned GitHub issues from GitHub API:', err);
    res
      .status(500)
      .json({ message: 'Failed to fetch assigned issues from GitHub API' });
  }
});

app.get('/tools/getIssueDetails', async (req, res) => {
  const { owner, repo, issueNumber } = req.query;

  if (!GITHUB_TOKEN) {
    res
      .status(500)
      .json({ message: 'GITHUB_TOKEN is not configured on the MCP server' });
    return;
  }

  if (
    typeof owner !== 'string' ||
    typeof repo !== 'string' ||
    (!issueNumber && issueNumber !== 0)
  ) {
    res
      .status(400)
      .json({ message: 'owner, repo, and issueNumber are required' });
    return;
  }

  try {
    const response = await githubApi.get(
      `/repos/${owner}/${repo}/issues/${issueNumber}`,
    );
    res.json(response.data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching GitHub issue details from API:', err);
    res
      .status(500)
      .json({ message: 'Failed to fetch issue details from GitHub API' });
  }
});

const PORT = 5001;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`GitHub MCP server listening on port ${PORT}`);
});
