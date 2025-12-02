import axios from 'axios';

const MCP_BASE_URL = 'http://localhost:5002';

export interface SlackMention {
  channelId: string;
  text: string;
  ts: string;
}

export const getMentions = async (
  sinceTs?: string,
): Promise<SlackMention[]> => {
  try {
    const response = await axios.get(`${MCP_BASE_URL}/tools/getMentions`, {
      params: sinceTs ? { sinceTs } : undefined,
    });

    const data = response.data;
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => ({
        channelId: item.channelId ?? item.channel_id ?? '',
        text: item.text ?? '',
        ts: item.ts ?? '',
      }))
      .filter((m) => m.channelId && m.ts && m.text);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching Slack mentions from MCP:', err);
    return [];
  }
};

export const getThreadSummary = async (
  channelId: string,
  threadTs: string,
): Promise<string> => {
  try {
    const response = await axios.get(
      `${MCP_BASE_URL}/tools/getThreadSummary`,
      {
        params: { channelId, threadTs },
      },
    );

    const data = response.data;
    if (typeof data === 'string') {
      return data;
    }

    if (typeof data?.summary === 'string') {
      return data.summary;
    }

    return '';
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching Slack thread summary from MCP:', err);
    return '';
  }
};

