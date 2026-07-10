import { Hono } from 'hono';
import * as Sentry from '@sentry/hono/bun';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@sora/database/client';
import { Role, Mode, MessageStatus } from '@sora/database/enums';
import { findSupportedChatModel, type SupportedChatModelId } from '@sora/shared';

const createSessionSchema = z.object({
  title: z.string(),
  cwd: z.string().optional(),
  initialMessage: z
    .object({
      role: z.enum(Role),
      content: z.string(),
      mode: z.enum(Mode),
      model: z.string().refine((id) => !!findSupportedChatModel(id as SupportedChatModelId), {
        message: 'Unsupported chat model',
      }),
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

const app = new Hono()
  .get('/', async (c) => {
    const sessions = await db.session.findMany({
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

    const session = await db.session.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      Sentry.logger.warn('Session not found', {
        sessionId: id,
        userId: 'mock-user-id', // TODO: Replace with actual user ID from auth
      });

      return c.json({ message: 'Session not found' }, 404);
    }

    Sentry.logger.info('Fetched session', {
      sessionId: id,
    });

    return c.json(session);
  })
  .post('/', createSessionValidator, async (c) => {
    const { initialMessage, ...data } = c.req.valid('json');

    const session = await db.session.create({
      data: {
        ...data,
        userId: 'mock-user-id', // TODO: Replace with actual user ID from auth
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
      userId: 'mock-user-id', // TODO: Replace with actual user ID from auth
    });

    return c.json(session, 201);
  });

export default app;
