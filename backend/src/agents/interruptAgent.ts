import { getInterruptModel } from './geminiClient';
import {
  DayPlan,
  InterruptAction,
  InterruptPriority,
} from '../types/core';

export interface InterruptAgentInput {
  notificationText: string;
  currentPlan: DayPlan;
}

export interface InterruptAgentOutput {
  priority: InterruptPriority;
  suggestedAction: InterruptAction;
  suggestedBlockId?: string;
  rationale: string;
}

const INTERRUPT_SCHEMA_DESCRIPTION = `
Expected JSON response shape:
{
  "priority": "URGENT" | "LATER" | "IGNORE",
  "suggestedAction": "START_NOW" | "ADD_TO_EXISTING_BLOCK" | "CREATE_NEW_BLOCK" | "IGNORE",
  "suggestedBlockId"?: string, // optional, only when it makes sense
  "rationale": string
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

const parseInterruptOutput = (raw: string): InterruptAgentOutput => {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Partial<InterruptAgentOutput>;

    const priority: InterruptPriority =
      parsed.priority === 'URGENT' ||
      parsed.priority === 'LATER' ||
      parsed.priority === 'IGNORE'
        ? parsed.priority
        : 'LATER';

    const suggestedAction: InterruptAction =
      parsed.suggestedAction === 'START_NOW' ||
      parsed.suggestedAction === 'ADD_TO_EXISTING_BLOCK' ||
      parsed.suggestedAction === 'CREATE_NEW_BLOCK' ||
      parsed.suggestedAction === 'IGNORE'
        ? parsed.suggestedAction
        : 'IGNORE';

    const rationale =
      typeof parsed.rationale === 'string' && parsed.rationale.trim().length > 0
        ? parsed.rationale
        : 'Model did not provide a rationale.';

    return {
      priority,
      suggestedAction,
      suggestedBlockId: parsed.suggestedBlockId,
      rationale,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      'Failed to parse InterruptAgentOutput from Gemini response:',
      err,
    );
    return {
      priority: 'LATER',
      suggestedAction: 'IGNORE',
      rationale:
        'Fallback decision because the model response could not be parsed.',
    };
  }
};

export const classifyInterrupt = async (
  input: InterruptAgentInput,
): Promise<InterruptAgentOutput> => {
  const model = getInterruptModel();

  const prompt = `
You are FlowPilot's interrupt management agent.
Your job is to classify incoming developer notifications and suggest how they
should be integrated into the current day plan.

Consider:
- The notification text may describe new work, changes in priority, incidents, or FYI messages.
- The current day plan shows existing deep work, shallow work, and meeting blocks.
- Avoid unnecessary context switching; only disrupt deep work for truly urgent items.

You must decide:
- "priority": how urgent this notification is for the developer ("URGENT" | "LATER" | "IGNORE").
- "suggestedAction": how to integrate this work into the day
  - "START_NOW": interrupt the current work and handle immediately.
  - "ADD_TO_EXISTING_BLOCK": map it to one of the existing blocks in the plan.
  - "CREATE_NEW_BLOCK": create a new dedicated block later in the day.
  - "IGNORE": no scheduling change needed.
- "suggestedBlockId": only when "ADD_TO_EXISTING_BLOCK" or "CREATE_NEW_BLOCK" makes sense.
- "rationale": brief natural language explanation for your decision.

Notification text:
${input.notificationText}

Current day plan (JSON):
${JSON.stringify(input.currentPlan, null, 2)}

Respond ONLY with JSON matching this shape:
${INTERRUPT_SCHEMA_DESCRIPTION}

Do not include any explanation or markdown outside the JSON.
`.trim();

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  return parseInterruptOutput(text);
};

