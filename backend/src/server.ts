import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';

import planRoutes from './routes/planRoutes';
import sessionRoutes from './routes/sessionRoutes';
import taskRoutes from './routes/taskRoutes';
import settingsRoutes from './routes/settingsRoutes';
import notificationRoutes from './routes/notificationRoutes';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use('/api', planRoutes);
app.use('/api', sessionRoutes);
app.use('/api', taskRoutes);
app.use('/api', settingsRoutes);
app.use('/api', notificationRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = (res.statusCode && res.statusCode !== 200) ? res.statusCode : 500;

  const response: { message: string; stack?: string } = {
    message: err.message || 'Internal Server Error',
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`FlowPilot backend listening on port ${port}`);
});

