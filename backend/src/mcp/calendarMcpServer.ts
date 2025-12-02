import 'dotenv/config';
import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const GOOGLE_CALENDAR_API_KEY = process.env.GOOGLE_CALENDAR_API_KEY;
const DEFAULT_TIMEZONE =
  process.env.DEFAULT_TIMEZONE || 'UTC';
const DEFAULT_WORK_START =
  process.env.DEFAULT_WORK_START || '09:00';
const DEFAULT_WORK_END =
  process.env.DEFAULT_WORK_END || '17:00';

if (!GOOGLE_CALENDAR_ID || !GOOGLE_CALENDAR_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    'GOOGLE_CALENDAR_ID or GOOGLE_CALENDAR_API_KEY not set. Calendar MCP server will return 500 for event requests.',
  );
}

app.get('/tools/getDayEvents', async (req, res) => {
  if (!GOOGLE_CALENDAR_ID || !GOOGLE_CALENDAR_API_KEY) {
    res.status(500).json({
      message:
        'GOOGLE_CALENDAR_ID and GOOGLE_CALENDAR_API_KEY must be configured on the Calendar MCP server',
    });
    return;
  }

  const date =
    typeof req.query.date === 'string'
      ? req.query.date
      : new Date().toISOString().slice(0, 10);
  const timezone =
    (typeof req.query.timezone === 'string'
      ? req.query.timezone
      : DEFAULT_TIMEZONE) || DEFAULT_TIMEZONE;

  const timeMin = new Date(`${date}T00:00:00`).toISOString();
  const timeMax = new Date(`${date}T23:59:59`).toISOString();

  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      GOOGLE_CALENDAR_ID,
    )}/events`;

    const response = await axios.get(url, {
      params: {
        key: GOOGLE_CALENDAR_API_KEY,
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        timeZone: timezone,
      },
    });

    const items = response.data?.items ?? [];

    const events = items.map((event: any) => {
      const start =
        event.start?.dateTime ??
        (event.start?.date ? `${event.start.date}T00:00:00` : undefined);
      const end =
        event.end?.dateTime ??
        (event.end?.date ? `${event.end.date}T23:59:59` : undefined);

      let title: string = (event.summary ?? '').trim();
      const description: string = event.description ?? '';
      const lowerTitleRaw = title.toLowerCase();
      const lowerTitle = title.toLowerCase();
      const lowerDescription = description.toLowerCase();

      let type: 'MEETING' | 'BLOCKED' | 'INFO' = 'MEETING';

      // Prefer explicit Calendar event type when available.
      if (event.eventType === 'outOfOffice') {
        type = 'BLOCKED';
      } else if (
        lowerTitle.includes('ooo') ||
        lowerTitle.includes('out of office') ||
        lowerTitle.includes('vacation') ||
        lowerTitle.includes('pto') ||
        lowerDescription.includes('ooo') ||
        lowerDescription.includes('out of office') ||
        lowerDescription.includes('vacation') ||
        lowerDescription.includes('pto')
      ) {
        type = 'BLOCKED';
      } else if (
        lowerTitle.includes('reminder') ||
        lowerTitle.includes('hold') ||
        lowerDescription.includes('reminder') ||
        lowerDescription.includes('hold')
      ) {
        type = 'INFO';
      } else if (start && end) {
        // Heuristic: long "Busy" blocks that span most of the workday
        // are likely OOO / blocked time.
        const startDate = new Date(start);
        const endDate = new Date(end);
        const durationHours =
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

        const workDurationHours = (() => {
          const [wsH, wsM] = DEFAULT_WORK_START.split(':').map(Number);
          const [weH, weM] = DEFAULT_WORK_END.split(':').map(Number);
          return (weH + weM / 60) - (wsH + wsM / 60);
        })();

        if (durationHours >= workDurationHours * 0.75) {
          type = 'BLOCKED';
        }
      }

      // If Google reported a generic "Busy" or empty title, try to
      // use the description as a more informative title.
      if (!title || lowerTitle === 'busy') {
        const descTrim = description.trim();
        if (descTrim.length > 0) {
          title = descTrim;
        } else {
          title = 'Busy';
        }
      }

      return {
        id: event.id as string,
        title,
        start: start as string,
        end: end as string,
        type,
        description,
      };
    });

    res.json(events);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching events from Google Calendar API:', err);
    res.status(500).json({
      message: 'Failed to fetch events from Google Calendar API',
    });
  }
});

app.get('/tools/getWorkingHours', (req, res) => {
  const _date = req.query.date;
  const _timezone =
    (typeof req.query.timezone === 'string'
      ? req.query.timezone
      : DEFAULT_TIMEZONE) || DEFAULT_TIMEZONE;

  // For now, working hours are driven by configuration/env.
  res.json({
    start: DEFAULT_WORK_START,
    end: DEFAULT_WORK_END,
  });
});

const PORT = 5003;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Calendar MCP server listening on port ${PORT}`);
});
