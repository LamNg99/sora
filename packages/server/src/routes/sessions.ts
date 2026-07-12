import { Hono } from 'hono';
import * as Sentry from '@sentry/hono/bun';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@sora/database/client';
import { Role, Mode, MessageStatus } from '@sora/database/enums';
import type { AuthenticatedEnv } from '../middleware/require-auth';
import { requireCreditsBalance } from '../middleware/require-credits-balance';
import { isSupportedChatModel } from '../lib/models';

const createSessionSchema = z.object({
  title: z.string(),
  cwd: z.string().optional(),
  initialMessage: z
    .object({
      role: z.enum(Role),
      content: z.string(),
      mode: z.enum(Mode),
      model: z.string().refine(isSupportedChatModel, 'Unsupported model'),
    })
    .optional(),
});

const createSessionValidator = zValidator('json', createSessionSchema, (result, c) => {
  if (!result.success) {
    Sentry.logger.warn('Invalid request body', {
      path: c.req.path,
      method: c.req.method,
      errors: result.error.issues.length,
    });

    return c.json({ message: 'Invalid request body' }, 400);
  }
});

const app = new Hono<AuthenticatedEnv>()
  .get('/', async (c) => {
    const userId = c.get('userId');

    const sessions = await db.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });

    Sentry.logger.info('Fetched sessions', {
      count: sessions.length,
    });

    return c.json(sessions);
  })
  .get('/:id', async (c) => {
    // await new Promise((resolve) => setTimeout(resolve, 5000));

    // throw new HTTPException(500, { message: 'Mock server error' });
    const id = c.req.param('id');
    const userId = c.get('userId');

    const session = await db.session.findUnique({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      Sentry.logger.warn('Session not found', {
        sessionId: id,
        userId,
      });

      return c.json({ message: 'Session not found' }, 404);
    }

    Sentry.logger.info('Fetched session', {
      sessionId: id,
    });

    return c.json(session);
  })
  .post('/', requireCreditsBalance, createSessionValidator, async (c) => {
    const userId = c.get('userId');
    const { initialMessage, ...data } = c.req.valid('json');

    const session = await db.session.create({
      data: {
        ...data,
        userId,
        ...(initialMessage && {
          messages: {
            create: { ...initialMessage, status: MessageStatus.COMPLETE },
          },
        }),
      },
      include: {
        messages: true,
      },
    });

    Sentry.logger.info('Created new session', {
      sessionId: session.id,
      title: session.title,
      userId,
    });

    return c.json(session, 201);
  });

export default app;
