type RequiredEnvKey =
  | 'GEMINI_API_KEY'
  | 'FIREBASE_PROJECT_ID'
  | 'FIREBASE_CLIENT_EMAIL'
  | 'FIREBASE_PRIVATE_KEY'
  | 'DEFAULT_TIMEZONE'
  | 'DEFAULT_WORK_START'
  | 'DEFAULT_WORK_END';

const requireEnv = (key: RequiredEnvKey): string => {
  const value = process.env[key];

  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export interface Env {
  geminiApiKey: string;
  firebaseProjectId: string;
  firebaseClientEmail: string;
  firebasePrivateKey: string;
  defaultTimezone: string;
  defaultWorkStart: string;
  defaultWorkEnd: string;
}

const rawFirebasePrivateKey = requireEnv('FIREBASE_PRIVATE_KEY');
const firebasePrivateKey = rawFirebasePrivateKey.replace(/\\n/g, '\n');

export const env: Env = {
  geminiApiKey: requireEnv('GEMINI_API_KEY'),
  firebaseProjectId: requireEnv('FIREBASE_PROJECT_ID'),
  firebaseClientEmail: requireEnv('FIREBASE_CLIENT_EMAIL'),
  firebasePrivateKey,
  defaultTimezone: requireEnv('DEFAULT_TIMEZONE'),
  defaultWorkStart: requireEnv('DEFAULT_WORK_START'),
  defaultWorkEnd: requireEnv('DEFAULT_WORK_END'),
};

