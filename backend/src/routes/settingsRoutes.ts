import { Router } from 'express';
import { db } from '../config/firebaseClient';

const router = Router();

const DEMO_USER_ID = 'demoUser';
const SETTINGS_PATH = `settings/${DEMO_USER_ID}`;

type SettingsPayload = {
  githubToken?: string;
  slackToken?: string;
  timezone?: string;
  workStart?: string;
  workEnd?: string;
};

const maskToken = (token?: string): string | undefined => {
  if (!token) return undefined;
  if (token.length <= 4) return '****';
  return `${token.slice(0, 4)}****`;
};

router.post('/settings', async (req, res) => {
  const payload = req.body as SettingsPayload;

  const maskedGithubToken = maskToken(payload.githubToken);
  const maskedSlackToken = maskToken(payload.slackToken);

  const settingsUpdate: Record<string, unknown> = {};

  if (payload.githubToken !== undefined) {
    settingsUpdate.githubToken = maskedGithubToken;
    settingsUpdate.githubTokenPlain = payload.githubToken;
  }
  if (payload.slackToken !== undefined) {
    settingsUpdate.slackToken = maskedSlackToken;
    settingsUpdate.slackTokenPlain = payload.slackToken;
  }
  if (payload.timezone !== undefined) {
    settingsUpdate.timezone = payload.timezone;
  }
  if (payload.workStart !== undefined) {
    settingsUpdate.workStart = payload.workStart;
  }
  if (payload.workEnd !== undefined) {
    settingsUpdate.workEnd = payload.workEnd;
  }

  try {
    await db.ref(SETTINGS_PATH).update(settingsUpdate);
    const snapshot = await db.ref(SETTINGS_PATH).get();
    res.json(snapshot.val());
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error saving settings:', err);
    res.status(500).json({ message: 'Failed to save settings' });
  }
});

router.get('/settings', async (_req, res) => {
  try {
    const snapshot = await db.ref(SETTINGS_PATH).get();
    res.json(snapshot.val() ?? {});
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching settings:', err);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

export default router;

