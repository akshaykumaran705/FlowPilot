import { getSessionModel } from './geminiClient';
import { SessionEvent } from '../types/core';

export interface SessionAgentInput {
  taskTitle: string;
  taskDescription?: string;
  previousSessionSummary?: string;
  events: SessionEvent[];
  slackSummary?: string;
  prDiffSummary?: string;
}

export interface SessionAgentOutput {
  sessionSummary: string;
  keyDecisions: string[];
  nextSteps: string[];
  riskFlags?: string;
}

const SESSION_SCHEMA_DESCRIPTION = `
Expected JSON response structure:
{
  "sessionSummary": string,        // concise narrative of what happened
  "keyDecisions": string[],        // bullet-style decisions made
  "nextSteps": string[],           // actionable follow-ups for the next session
  "riskFlags"?: string             // optional notes about risks or uncertainties
}
`.trim();

const extractJson = (text: string): string => {
  const trimmed = text.trim();

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // continue
  }

  const codeFenceMatch =
    trimmed.match(/```json([\s\S]*?)```/i) ??
    trimmed.match(/```([\s\S]*?)```/i);
  if (codeFenceMatch && codeFenceMatch[1]) {
    const candidate = codeFenceMatch[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // continue
    }
  }

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

const parseSessionOutput = (raw: string): SessionAgentOutput => {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Partial<SessionAgentOutput>;

    const sessionSummary =
      typeof parsed.sessionSummary === 'string' &&
      parsed.sessionSummary.trim().length > 0
        ? parsed.sessionSummary
        : 'Session summary not provided by model.';

    const keyDecisions = Array.isArray(parsed.keyDecisions)
      ? parsed.keyDecisions.filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0,
        )
      : [];

    const nextSteps = Array.isArray(parsed.nextSteps)
      ? parsed.nextSteps.filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0,
        )
      : [];

    const riskFlags =
      typeof parsed.riskFlags === 'string' &&
      parsed.riskFlags.trim().length > 0
        ? parsed.riskFlags
        : undefined;

    return {
      sessionSummary,
      keyDecisions,
      nextSteps,
      ...(riskFlags ? { riskFlags } : {}),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      'Failed to parse SessionAgentOutput from Gemini response:',
      err,
    );
    return {
      sessionSummary:
        'Automatic summary unavailable due to parsing error. Review session events manually.',
      keyDecisions: [],
      nextSteps: [],
    };
  }
};

export const summarizeSession = async (
  input: SessionAgentInput,
): Promise<SessionAgentOutput> => {
  const model = getSessionModel();

  const prompt = `
You are FlowPilot's coding session summarization agent.
Your job is to read the session context and produce:
- A concise session summary.
- A list of key decisions made.
- A list of concrete next steps for the developer.
- Optional risk flags (uncertainties, blockers, or concerns).

Task context:
- Title: ${input.taskTitle}
- Description: ${input.taskDescription ?? '(none provided)'}

Previous session summary (if any):
${input.previousSessionSummary ?? '(none)'}

Session events (JSON):
${JSON.stringify(input.events, null, 2)}

Slack summary (if any):
${input.slackSummary ?? '(none)'}

PR diff summary (if any):
${input.prDiffSummary ?? '(none)'}

Respond ONLY with JSON in this shape:
${SESSION_SCHEMA_DESCRIPTION}

Do not include markdown or any text outside the JSON.
`.trim();

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  return parseSessionOutput(text);
};

