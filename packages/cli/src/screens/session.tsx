import { useLocation, useNavigate, useParams } from 'react-router';
import { SessionShell } from '../components/session-shell';
import type { InferResponseType } from 'hono';
import { apiClient } from '../lib/api-client';
import { z } from 'zod';
import prettyMs from 'pretty-ms';
import { DEFAULT_CHAT_MODEL_ID, type SupportedChatModelId } from '@sora/shared';
import { BotMessage, UserMessage } from '../components/messages';
import { useChat } from '../hooks/use-chat';
import type { Message } from '../hooks/use-chat';
import { useToast } from '../providers/toast';
import { useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '../lib/http-errors';
import { MessageStatus } from '@sora/database/enums';
import { useKeyboard } from '@opentui/react';
import { useKeyboardLayer } from '../providers/keyboard-layer';

type SessionData = InferResponseType<(typeof apiClient.sessions)[':id']['$get'], 200>;

const sessionLocationSchema = z.object({
  session: z.custom<SessionData>(
    (value) => value != null && typeof value === 'object' && 'id' in value,
  ),
});

function mapDbMeassages(dbMessages: SessionData['messages']): Message[] {
  return dbMessages.map((msg) => {
    if (msg.role === 'ERROR') {
      return {
        id: msg.id,
        role: 'error',
        content: msg.content,
      };
    }

    if (msg.role === 'USER') {
      return {
        id: msg.id,
        role: 'user',
        content: msg.content,
        mode: msg.mode,
        model: msg.model as SupportedChatModelId,
      };
    }

    return {
      id: msg.id,
      role: 'user',
      content: msg.content,
      mode: msg.mode,
      model: msg.model as SupportedChatModelId,
      parts: [
        {
          type: 'text',
          text: msg.content,
        },
      ],
      ...(msg.duration != null ? { duration: prettyMs(msg.duration * 1000) } : {}),
      interrupted: msg.status === MessageStatus.INTERRUPTED,
    };
  });
}

function ChatMessage({ msg }: { msg: Message }) {
  if (msg.role === 'user') {
    return <UserMessage message={msg.content} />;
  }

  if (msg.role === 'error') {
    return <UserMessage message={msg.content} />;
  }

  return (
    <BotMessage
      parts={msg.parts}
      model={msg.model}
      mode={msg.mode}
      duration={msg.duration}
      streaming={false}
      interrupted={msg.interrupted}
    />
  );
}

function SessionChat({ session }: { session: SessionData }) {
  const [initialMessages] = useState(() => mapDbMeassages(session.messages));
  const { isTopLayer } = useKeyboardLayer();
  const { messages, streaming, submit, abort, interrupt } = useChat(session.id, initialMessages);

  useEffect(() => {
    return () => abort();
  }, [abort]);

  useKeyboard((key) => {
    if (key.name === 'escape' && isTopLayer('base') && streaming.status === 'streaming') {
      key.preventDefault();
      interrupt();
    }
  });

  return (
    <SessionShell
      onSubmit={(text) =>
        submit({
          userText: text,
          mode: 'AGENT',
          model: DEFAULT_CHAT_MODEL_ID,
        })
      }
      loading={streaming.status === 'streaming'}
      interruptible={streaming.status === 'streaming'}
    >
      {messages.map((msg) => (
        <ChatMessage key={msg.id} msg={msg} />
      ))}
      {streaming.status === 'streaming' && streaming.parts.length > 0 && (
        <BotMessage
          parts={streaming.parts}
          model={streaming.model}
          mode={streaming.mode}
          streaming
        />
      )}
    </SessionShell>
  );
}

export function Session() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const prefetched = useMemo(() => {
    const parsed = sessionLocationSchema.safeParse(location.state);
    return parsed.success ? parsed.data.session : null;
  }, [location.state]);

  const [session, setSession] = useState<SessionData | null>(prefetched);

  useEffect(() => {
    if (prefetched) return;
    setSession(null);
    if (!id) return;

    let ignore = false;
    const fetchSession = async () => {
      try {
        const res = await apiClient.sessions[':id'].$get({ param: { id } });
        if (ignore) return;
        if (!res.ok) throw new Error(await getErrorMessage(res));
        setSession(await res.json());
      } catch (error) {
        if (ignore) return;
        toast.show({
          variant: 'error',
          message: error instanceof Error ? error.message : 'Failed to fetch session',
        });

        navigate('/', { replace: true });
      }
    };

    fetchSession();
    return () => {
      ignore = true;
    };
  }, [id, prefetched, toast, navigate]);

  if (!session) {
    return <SessionShell onSubmit={() => {}} inputDisabled />;
  }

  return <SessionChat key={session.id} session={session} />;
}
