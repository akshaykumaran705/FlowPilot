import axios from 'axios';

const MCP_BASE_URL = 'http://localhost:5003';

export type CalendarEventType = 'MEETING' | 'BLOCKED' | 'INFO';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: CalendarEventType;
  description?: string;
}

export const getDayEvents = async (
  date: string,
  timezone: string,
): Promise<CalendarEvent[]> => {
  try {
    const response = await axios.get(`${MCP_BASE_URL}/tools/getDayEvents`, {
      params: { date, timezone },
    });

    const data = response.data;
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => ({
        id: String(item.id ?? ''),
        title: item.title ?? '',
        start: item.start ?? '',
        end: item.end ?? '',
        type: item.type as CalendarEventType,
        description: item.description ?? '',
      }))
      .filter(
        (event) =>
          !!event.id &&
          !!event.title &&
          !!event.start &&
          !!event.end &&
          (event.type === 'MEETING' ||
            event.type === 'BLOCKED' ||
            event.type === 'INFO'),
      );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching calendar day events from MCP:', err);
    return [];
  }
};

export interface WorkingHours {
  start: string;
  end: string;
}

export const getWorkingHours = async (
  date: string,
  timezone: string,
): Promise<WorkingHours> => {
  try {
    const response = await axios.get(`${MCP_BASE_URL}/tools/getWorkingHours`, {
      params: { date, timezone },
    });

    const data = response.data;
    if (data && typeof data.start === 'string' && typeof data.end === 'string') {
      return { start: data.start, end: data.end };
    }

    return { start: '', end: '' };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching working hours from MCP:', err);
    return { start: '', end: '' };
  }
};
