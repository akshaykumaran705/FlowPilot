import 'dotenv/config';
import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_USER_ID = process.env.SLACK_USER_ID;
const SLACK_CHANNEL_IDS = process.env.SLACK_CHANNEL_IDS;

if (!SLACK_BOT_TOKEN) {
  // eslint-disable-next-line no-console
  console.warn(
    'SLACK_BOT_TOKEN is not set. Slack MCP server will return 500 for requests.',
  );
}

if (!SLACK_CHANNEL_IDS) {
  // eslint-disable-next-line no-console
  console.warn(
    'SLACK_CHANNEL_IDS is not set. Slack MCP server will not know which channels to scan for mentions.',
  );
}

const slackApi = axios.create({
  baseURL: 'https://slack.com/api',
  headers: {
    Authorization: SLACK_BOT_TOKEN ? `Bearer ${SLACK_BOT_TOKEN}` : '',
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

app.get('/tools/getMentions', async (req, res) => {
  if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL_IDS) {
    res.status(500).json({
      message:
        'SLACK_BOT_TOKEN and SLACK_CHANNEL_IDS must be configured on the Slack MCP server',
    });
    return;
  }

  const sinceTs =
    typeof req.query.sinceTs === 'string' ? req.query.sinceTs : undefined;
  const channelIds = SLACK_CHANNEL_IDS.split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const results: { channelId: string; text: string; ts: string }[] = [];

  try {
    // Fetch messages from each configured channel and collect mentions.
    for (const channelId of channelIds) {
      const response = await slackApi.get('/conversations.history', {
        params: {
          channel: channelId,
          oldest: sinceTs,
          limit: 100,
        },
      });

      const data = response.data;
      if (!data || !data.ok) {
        // eslint-disable-next-line no-console
        console.warn(
          `Slack API conversations.history failed for channel ${channelId}:`,
          data,
        );
        continue;
      }

      const messages: Array<{
        text?: string;
        ts?: string;
        subtype?: string;
      }> = data.messages ?? [];

      messages.forEach((msg) => {
        if (!msg.ts || !msg.text) return;
        if (msg.subtype) return; // skip joins/bots/etc.

        if (SLACK_USER_ID) {
          const mentionToken = `<@${SLACK_USER_ID}>`;
          if (!msg.text.includes(mentionToken)) return;
        }

        results.push({
          channelId,
          text: msg.text,
          ts: msg.ts,
        });
      });
    }

    res.json(results);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching mentions from Slack API:', err);
    res
      .status(500)
      .json({ message: 'Failed to fetch mentions from Slack API' });
  }
});

app.get('/tools/getThreadSummary', async (req, res) => {
  const { channelId, threadTs } = req.query;

  if (!SLACK_BOT_TOKEN) {
    res
      .status(500)
      .json({ message: 'SLACK_BOT_TOKEN is not configured on the MCP server' });
    return;
  }

  if (typeof channelId !== 'string' || typeof threadTs !== 'string') {
    res
      .status(400)
      .json({ message: 'channelId and threadTs are required query params' });
    return;
  }

  try {
    const response = await slackApi.get('/conversations.replies', {
      params: {
        channel: channelId,
        ts: threadTs,
        limit: 100,
      },
    });

    const data = response.data;
    if (!data || !data.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `Slack API conversations.replies failed for channel ${channelId} thread ${threadTs}:`,
        data,
      );
      res.status(500).json({
        message: 'Failed to fetch thread messages from Slack API',
      });
      return;
    }

    const messages: Array<{ text?: string }> = data.messages ?? [];
    const lines = messages
      .map((m) => m.text ?? '')
      .filter((t) => t.trim().length > 0);

    const summary =
      lines.length === 0
        ? 'No messages found in this thread.'
        : lines.join('\n');

    res.json({ summary });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching Slack thread from API:', err);
    res
      .status(500)
      .json({ message: 'Failed to fetch thread from Slack API' });
  }
});

const PORT = 5002;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Slack MCP server listening on port ${PORT}`);
});
