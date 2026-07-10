import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { streamText as aiStreamText } from 'ai';
import { db } from '@sora/database/client';
import { Mode, MessageStatus } from '@sora/database/enums';
import { type ChatStreamEvent } from '@sora/shared';
import { isSupportedChatModel, resolveChatModel } from '../lib/models';

const submitSchema = z.object({
  content: z.string(),
  mode: z.enum(Mode),
  model: z.string().refine(isSupportedChatModel, 'Unsupported chat model'),
});

const submitValidator = zValidator('json', submitSchema, (result, c) => {
  if (!result.success) {
    return c.json({ message: 'Invalid request body' }, 400);
  }
});

const activeResumeSessionIds = new Set<string>();

function buildConversationHistory(
  messages: { role: 'USER' | 'ASSISTANT' | 'ERROR'; content: string; status: MessageStatus }[],
) {
  return messages.flatMap((message) => {
    if (message.role === 'ERROR') return [];
    if (message.role === 'ASSISTANT' && message.content.length === 0) return [];
    return [
      {
        role: message.role === 'USER' ? ('user' as const) : ('assistant' as const),
        content: message.content,
      },
    ];
  });
}

function getResumableUserMessage(
  messages: { role: 'USER' | 'ASSISTANT' | 'ERROR'; model: string; mode: Mode }[],
) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'USER') {
    return null;
  }

  return lastMessage;
}

type StreamParams = {
  sessionId: string;
  model: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  mode: Mode;
  abortController: AbortController;
};
async function streamResponse(
  stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
  params: StreamParams,
) {
  const { sessionId, model, history, mode, abortController } = params;
  const startTime = Date.now();
  const resolvedModel = resolveChatModel(model);

  let fullText = '';

  const persistInterruptedMessage = async () => {
    if (fullText.length === 0) return;

    const elapsedTime = Date.now() - startTime;

    await db.message.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        status: MessageStatus.INTERRUPTED,
        model,
        content: fullText,
        mode,
        duration: Math.round(elapsedTime / 1000),
      },
    });
  };

  try {
    const result = aiStreamText({
      model: resolvedModel.model,
      messages: history,
      abortSignal: abortController.signal,
    });

    for await (const part of result.stream) {
      if (stream.aborted) break;

      if (part.type === 'text-delta') {
        fullText += part.text;
        const event: ChatStreamEvent = {
          type: 'text-delta',
          text: part.text,
        };

        await stream.writeSSE({ event: 'text-delta', data: JSON.stringify(event) });
      }

      if (part.type === 'error') {
        throw part.error;
      }
    }

    if (stream.aborted || abortController.signal.aborted) {
      await persistInterruptedMessage();
      return;
    }

    const elapsedTime = Date.now() - startTime;

    const assistantMessage = await db.message.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        status: MessageStatus.COMPLETE,
        model,
        content: fullText,
        mode,
        duration: Math.round(elapsedTime / 1000),
      },
    });

    const doneEvent: ChatStreamEvent = {
      type: 'done',
      messageId: assistantMessage.id,
      durationMs: elapsedTime,
    };

    await stream.writeSSE({ event: 'done', data: JSON.stringify(doneEvent) });
  } catch (error) {
    if (abortController.signal.aborted) {
      await persistInterruptedMessage();
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    await db.message.create({
      data: {
        sessionId,
        role: 'ERROR',
        status: MessageStatus.COMPLETE,
        model,
        content: errorMessage,
        mode,
      },
    });

    const errorEvent: ChatStreamEvent = {
      type: 'error',
      message: errorMessage,
    };

    await stream.writeSSE({ event: 'error', data: JSON.stringify(errorEvent) });
  }
}

const app = new Hono()
  .post('/:sessionId/resume', async (c) => {
    const sessionId = c.req.param('sessionId');

    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      return c.json({ message: 'Session not found' }, 404);
    }

    const resumableUserMessage = getResumableUserMessage(session.messages);
    if (!resumableUserMessage) {
      return c.json({ message: 'Session has no pending user message to resume' }, 409);
    }

    if (!isSupportedChatModel(resumableUserMessage.model)) {
      return c.json(
        { message: `Session uses an unsupported chat model: ${resumableUserMessage.model}` },
        409,
      );
    }

    if (activeResumeSessionIds.has(sessionId)) {
      return c.json({ message: 'A resume request is already in progress for this session' }, 409);
    }

    activeResumeSessionIds.add(sessionId);

    const history = buildConversationHistory(session.messages);
    const abortController = new AbortController();

    try {
      return streamSSE(
        c,
        async (stream) => {
          stream.onAbort(() => {
            abortController.abort();
          });
          try {
            await streamResponse(stream, {
              sessionId,
              model: resumableUserMessage.model,
              history,
              mode: resumableUserMessage.mode,
              abortController,
            });
          } finally {
            activeResumeSessionIds.delete(sessionId);
          }
        },
        async (error, stream) => {
          activeResumeSessionIds.delete(sessionId);
          const message = error instanceof Error ? error.message : String(error);
          const errorEvent: ChatStreamEvent = {
            type: 'error',
            message,
          };
          await stream.writeSSE({ event: 'error', data: JSON.stringify(errorEvent) });
        },
      );
    } catch (error) {
      activeResumeSessionIds.delete(sessionId);
      throw error;
    }
  })
  .post('/:sessionId', submitValidator, async (c) => {
    const sessionId = c.req.param('sessionId');

    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      return c.json({ message: 'Session not found' }, 404);
    }

    const data = c.req.valid('json');

    await db.message.create({
      data: {
        sessionId,
        role: 'USER',
        status: MessageStatus.COMPLETE,
        model: data.model,
        content: data.content,
        mode: data.mode,
      },
    });

    const history = buildConversationHistory([
      ...session.messages, // TODO: limit to last 10 messages or based on token count
      {
        role: 'USER',
        content: data.content,
        status: MessageStatus.COMPLETE,
      },
    ]);

    const abortController = new AbortController();

    return streamSSE(
      c,
      async (stream) => {
        stream.onAbort(() => {
          abortController.abort();
        });

        await streamResponse(stream, {
          sessionId,
          model: data.model,
          history,
          mode: data.mode,
          abortController,
        });
      },
      async (error, stream) => {
        const message = error instanceof Error ? error.message : String(error);
        const errorEvent: ChatStreamEvent = {
          type: 'error',
          message,
        };
        await stream.writeSSE({ event: 'error', data: JSON.stringify(errorEvent) });
      },
    );
  });

export default app;
