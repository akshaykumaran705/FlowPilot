import admin from 'firebase-admin';
import { env } from './env';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebaseProjectId,
      clientEmail: env.firebaseClientEmail,
      privateKey: env.firebasePrivateKey,
    }),
    databaseURL:
      process.env.FIREBASE_DATABASE_URL ||
      `https://${env.firebaseProjectId}.firebaseio.com`,
  });
}

export const db: admin.database.Database = admin.database();

export const getRef = (path: string): admin.database.Reference => db.ref(path);

export const getUserRef = (userId: string): admin.database.Reference =>
  getRef(`users/${userId}`);

