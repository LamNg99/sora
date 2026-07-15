import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { SessionShell } from '../components/session-shell';
import type { InferResponseType } from 'hono';
import { apiClient } from '../lib/api-client';
import { z } from 'zod';
import { type ModeType, type SupportedChatModelId } from '@sora/shared';
import { BotMessage, ErrorMessage, UserMessage } from '../components/messages';
import { useChat } from '../hooks/use-chat';
import type { Message } from '../hooks/use-chat';
import { useToast } from '../providers/toast';
import { getErrorMessage } from '../lib/http-errors';
import { useKeyboard } from '@opentui/react';
import { useKeyboardLayer } from '../providers/keyboard-layer';
import { usePromptConfig } from '../providers/prompt-config';

type SessionData = InferResponseType<(typeof apiClient.sessions)[':id']['$get'], 200>;

const sessionLocationSchema = z.object({
  session: z.custom<SessionData>(
    (value) =>
      value != null &&
      typeof value === 'object' &&
      'id' in value &&
      'messages' in value &&
      Array.isArray((value as SessionData).messages),
  ),
  initialPrompt: z
    .object({
      message: z.string(),
      mode: z.custom<ModeType>(),
      model: z.custom<SupportedChatModelId>(),
    })
    .optional(),
});

type ToolApprovalHandlers = {
  onApproveTool: (approvalId: string) => void;
  onDenyTool: (approvalId: string) => void;
};

type ClientToolCallPart = Extract<Message['parts'][number], { type: `tool-${string}` | 'dynamic-tool' }>;

function isToolPart(part: Message['parts'][number]): part is ClientToolCallPart {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-');
}

function getPendingApprovalId(messages: Message[]) {
  for (const message of messages) {
    for (const part of message.parts) {
      if (isToolPart(part) && part.state === 'approval-requested' && !part.approval.isAutomatic) {
        return part.approval.id;
      }
    }
  }

  return undefined;
}

function ChatMessage({
  msg,
  onApproveTool,
  onDenyTool,
  activeApprovalId,
}: { msg: Message; activeApprovalId?: string } & ToolApprovalHandlers) {
  if (msg.role === 'user') {
    const text = msg.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('');
    return <UserMessage message={text} mode={msg.metadata?.mode ?? 'AGENT'} />;
  }

  return (
    <BotMessage
      parts={msg.parts}
      model={msg.metadata?.model ?? 'unknown'}
      mode={msg.metadata?.mode ?? 'AGENT'}
      durationMs={msg.metadata?.durationMs}
      streaming={false}
      onApproveTool={onApproveTool}
      onDenyTool={onDenyTool}
      activeApprovalId={activeApprovalId}
    />
  );
}

function SessionChat({
  session,
  initialPrompt,
}: {
  session: SessionData;
  initialPrompt?: { message: string; mode: ModeType; model: SupportedChatModelId };
}) {
  const [initialMessages] = useState(() => session.messages as unknown as Message[]);
  const { isTopLayer } = useKeyboardLayer();
  const { mode, model } = usePromptConfig();
  const { messages, status, submit, approveTool, denyTool, abort, interrupt, error } = useChat(
    session.id,
    initialMessages,
  );

  const hasSubmittedInitialPrompt = useRef(false);
  const pendingApprovalId = getPendingApprovalId(messages);
  const waitingForApproval = pendingApprovalId != null;
  const abortRef = useRef(abort);
  abortRef.current = abort;

  useEffect(() => {
    return () => void abortRef.current();
  }, []);

  useKeyboard((key) => {
    if (key.name === 'escape' && isTopLayer('base') && status === 'streaming') {
      key.preventDefault();
      interrupt();
    }
  });

  useEffect(() => {
    if (!initialPrompt || hasSubmittedInitialPrompt.current) return;
    hasSubmittedInitialPrompt.current = true;

    submit({
      userText: initialPrompt.message,
      mode: initialPrompt.mode,
      model: initialPrompt.model,
    });
  }, [initialPrompt, submit]);

  return (
    <SessionShell
      onSubmit={(text) =>
        submit({
          userText: text,
          mode,
          model,
        })
      }
      loading={!waitingForApproval && (status === 'submitted' || status === 'streaming')}
      interruptible={!waitingForApproval && (status === 'submitted' || status === 'streaming')}
      inputDisabled={waitingForApproval || status === 'streaming'}
      footerHint={waitingForApproval ? 'Approve or deny the requested tool call' : undefined}
    >
      {messages.map((msg) => (
        <ChatMessage
          key={msg.id}
          msg={msg}
          onApproveTool={approveTool}
          onDenyTool={denyTool}
          activeApprovalId={pendingApprovalId}
        />
      ))}
      {error && <ErrorMessage message={error.message} />}
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
    return parsed.success ? parsed.data : null;
  }, [location.state]);

  const [session, setSession] = useState<SessionData | null>(prefetched?.session ?? null);

  useEffect(() => {
    // Skip fetch if session was passed via location state
    if (prefetched?.session) return;
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

  return (
    <SessionChat key={session.id} session={session} initialPrompt={prefetched?.initialPrompt} />
  );
}
