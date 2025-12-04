import { getPlanningModel } from './geminiClient';
import { DayPlan, Task } from '../types/core';

export interface PlanningAgentEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: 'MEETING' | 'BLOCKED' | 'INFO';
  description?: string;
}

export interface PlanningAgentInput {
  date: string;
  timezone: string;
  workStart: string; // "HH:MM"
  workEnd: string; // "HH:MM"
  tasks: Task[];
  events: PlanningAgentEvent[];
}

const DAY_PLAN_SCHEMA_DESCRIPTION = `
TypeScript schema for the required response:

interface DayPlan {
  date: string; // ISO date (e.g. "2024-03-01")
  blocks: PlanBlock[];
  generatedAt: string; // ISO timestamp
}

type PlanBlockMode = 'DEEP_WORK' | 'SHALLOW' | 'MEETING';

interface PlanBlock {
  id: string; // unique id for the block
  start: string; // ISO timestamp within the given date and working hours
  end: string;   // ISO timestamp within the given date and working hours
  label: string; // human-readable description of the block
  mode: PlanBlockMode;
  taskIds: string[]; // ids of tasks assigned to this block
  notes?: string; // optional description, especially for meetings or calendar-driven blocks
}
`.trim();

const extractJson = (text: string): string => {
  const trimmed = text.trim();

  // Try straightforward parse first.
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // continue
  }

  // Try fenced code block ```json ... ```
  const codeFenceMatch = trimmed.match(/```json([\s\S]*?)```/i) ?? trimmed.match(/```([\s\S]*?)```/i);
  if (codeFenceMatch && codeFenceMatch[1]) {
    const candidate = codeFenceMatch[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // continue
    }
  }

  // Fallback: first { ... } block
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // ignore
    }
  }

  throw new Error('Unable to extract JSON from model response');
};

const parseDayPlan = (raw: string, input: PlanningAgentInput): DayPlan => {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as DayPlan;

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Parsed value is not an object');
    }

    if (!parsed.date) {
      parsed.date = input.date;
    }
    if (!Array.isArray(parsed.blocks)) {
      parsed.blocks = [];
    }
    if (!parsed.generatedAt) {
      parsed.generatedAt = new Date().toISOString();
    }

    // Post-process MEETING blocks to ensure they use the original
    // calendar event titles and descriptions when available.
    if (Array.isArray(parsed.blocks) && input.events?.length) {
      const eventsSorted = [...input.events].filter(Boolean).sort((a, b) => {
        const aTime = new Date(a.start).getTime();
        const bTime = new Date(b.start).getTime();
        return aTime - bTime;
      });

      parsed.blocks = parsed.blocks.map((block) => {
        if (!block || block.mode !== 'MEETING' || !eventsSorted.length) {
          return block;
        }

        try {
          const blockStart = new Date(block.start).getTime();
          if (Number.isNaN(blockStart)) {
            return block;
          }

          // Find the closest calendar event by start time.
          let bestEvent = eventsSorted[0];
          let bestDiff = Math.abs(new Date(bestEvent.start).getTime() - blockStart);

          for (let i = 1; i < eventsSorted.length; i += 1) {
            const e = eventsSorted[i];
            const eStart = new Date(e.start).getTime();
            if (Number.isNaN(eStart)) continue;
            const diff = Math.abs(eStart - blockStart);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestEvent = e;
            }
          }

          const updated = { ...block };
          if (bestEvent.title) {
            updated.label = bestEvent.title;
          }
          if (!updated.notes && bestEvent.description) {
            updated.notes = bestEvent.description;
          }

          return updated;
        } catch {
          return block;
        }
      });
    }

    return parsed;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to parse DayPlan from Gemini response:', err);
    // Fallback: empty plan for the day.
    return {
      date: input.date,
      blocks: [],
      generatedAt: new Date().toISOString(),
    };
  }
};

export const planDay = async (input: PlanningAgentInput): Promise<DayPlan> => {
  const model = getPlanningModel();

  const prompt = `
You are FlowPilot's planning agent. Your job is to help a software developer plan their workday into focused blocks.

Guidelines:
- Respect the user's working hours exactly: from ${input.workStart} to ${input.workEnd} in timezone ${input.timezone}.
- Use three types of blocks: "DEEP_WORK", "SHALLOW", and "MEETING".
- Meetings are fixed and must match the given events of type "MEETING".
- Avoid overlapping blocks.
- Tasks may include a "dueDate" (YYYY-MM-DD). Treat tasks with earlier due dates as higher priority, and try to allocate enough deep work time on or before their due date.
- Tasks whose labels include "slack" represent work requested via Slack and should usually be scheduled in their own dedicated blocks (for example, labeled "Slack: ..."), not mixed into the same blocks as Jira or GitHub issue work.
- When deciding whether a Slack-derived task and a Jira task are part of the same underlying work, compare their titles and textual context:
  - If the Jira issue title and the Slack task title/description clearly describe the same thing (similar key phrases, same feature/bug name, etc.), you may group them into the same block.
  - Do NOT rely on ids or labels (like "JIRA_KEY:ABC-123") to determine this; use the natural language content instead.
- Otherwise, keep Slack tasks separate from Jira tasks.
- Group related tasks into deep work blocks when possible.
- Leave reasonable short breaks between long deep work blocks.
 - When using calendar events (MEETING/BLOCKED/INFO), use the event's title as the label and, when helpful, include a concise description in the block's "notes" field.

The user context is:
- Date: ${input.date}
- Timezone: ${input.timezone}
- Working hours: ${input.workStart} - ${input.workEnd}

Tasks (JSON). Each task has: "id", "title", optional "description", optional "url", "source" ("GITHUB" | "JIRA" | "LOCAL"), optional "labels", and optional "dueDate" (YYYY-MM-DD). Use "dueDate" to prioritize what to schedule during this day, focusing first on tasks whose due dates are soonest and especially those due today or already overdue. Tasks with a "slack" label should be treated as Slack tasks; tasks with labels like "JIRA_KEY:ABC-123" indicate the corresponding Jira issue key. Only group Slack and Jira tasks when they share the same "JIRA_KEY:..." label; otherwise, schedule Slack tasks as separate from Jira work.
${JSON.stringify(input.tasks, null, 2)}

Calendar / context events (JSON, including optional descriptions):
${JSON.stringify(input.events, null, 2)}

Your response MUST be a single JSON object matching this schema (no extra fields):
${DAY_PLAN_SCHEMA_DESCRIPTION}

Important:
- Only respond with JSON, no explanations, no markdown.
- Ensure all timestamps are valid ISO8601 strings.
`.trim();

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  return parseDayPlan(text, input);
};
