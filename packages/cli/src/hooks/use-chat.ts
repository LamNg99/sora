import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat as useAiChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  type InferUITools,
  lastAssistantMessageIsCompleteWithToolCalls,
  type LanguageModelUsage,
  type UIMessage,
} from 'ai';
import {
  requiresToolApproval,
  type LoadedSkill,
  type McpToolDefinition,
  type ModeType,
  type SupportedChatModelId,
  type ToolContracts,
} from '@sora/shared';
import { apiClient } from '../lib/api-client';
import { getAuth } from '../lib/auth';
import { executeLocalTool } from '../lib/local-tools';
import { mcpManager } from '../lib/mcp-manager';
import type { Skill } from '../lib/skills';

export type ChatMessageMetadata = {
  mode?: ModeType;
  model?: SupportedChatModelId | string;
  durationMs?: number;
  usage?: LanguageModelUsage;
};

type ChatTools = {
  [Name in keyof InferUITools<ToolContracts>]: {
    input: InferUITools<ToolContracts>[Name]['input'];
    output: unknown;
  };
};

export type Message = UIMessage<ChatMessageMetadata, never, ChatTools>;

type ClientToolCallPart = Extract<
  Message['parts'][number],
  { type: `tool-${string}` | 'dynamic-tool' }
>;
function isToolPart(part: Message['parts'][number]): part is ClientToolCallPart {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-');
}

function getToolName(part: ClientToolCallPart) {
  return part.type === 'dynamic-tool' ? part.toolName : part.type.slice('tool-'.length);
}

function findApprovalRequest(messages: Message[], approvalId: string) {
  for (const message of messages) {
    for (const part of message.parts) {
      if (
        isToolPart(part) &&
        part.state === 'approval-requested' &&
        part.approval.id === approvalId
      ) {
        return { message, part };
      }
    }
  }

  return null;
}

function hasApprovedToolCall(messages: Message[], toolCallId: string) {
  return messages.some((message) =>
    message.parts.some(
      (part) =>
        isToolPart(part) &&
        part.toolCallId === toolCallId &&
        'approval' in part &&
        part.approval?.approved === true,
    ),
  );
}

function lastAssistantMessageIsCompleteWithDeniedApproval({ messages }: { messages: Message[] }) {
  const message = messages.at(-1);
  if (!message || message.role !== 'assistant') return false;

  const lastStepStart = message.parts.findLastIndex((part) => part.type === 'step-start');
  const lastStepParts =
    lastStepStart === -1 ? message.parts : message.parts.slice(lastStepStart + 1);
  const toolParts = lastStepParts.filter(isToolPart);
  if (!toolParts.some((part) => part.approval?.approved === false)) return false;

  return toolParts.every(
    (part) =>
      part.state === 'output-available' ||
      part.state === 'output-error' ||
      part.state === 'output-denied' ||
      (part.state === 'approval-responded' && part.approval?.approved === false),
  );
}

type SkillContext = {
  availableSkills: Skill[];
  toggleSkill: (name: string) => void;
};

export function useChat(
  sessionId: string,
  initialMessages: Message[],
  loadedSkills: LoadedSkill[] = [],
  skillContext?: SkillContext,
) {
  const [mcpTools, setMcpTools] = useState<Record<string, McpToolDefinition>>({});
  const mcpToolsRef = useRef(mcpTools);
  mcpToolsRef.current = mcpTools;

  const loadedSkillsRef = useRef(loadedSkills);
  loadedSkillsRef.current = loadedSkills;

  const skillContextRef = useRef(skillContext);
  skillContextRef.current = skillContext;

  useEffect(() => {
    mcpManager
      .initialize()
      .then(() => setMcpTools(mcpManager.getToolDefinitions()))
      .catch(() => {});
  }, []);

  const transport = useMemo(() => {
    return new DefaultChatTransport<Message>({
      api: apiClient.chat.$url().toString(),
      headers() {
        const auth = getAuth();
        return auth ? { Authorization: `Bearer ${auth.token}` } : new Headers();
      },
      prepareSendMessagesRequest({ messages }) {
        const message = messages[messages.length - 1];
        if (!message) throw new Error('No message to send');

        const metadata = messages.findLast((m) => m.metadata?.mode && m.metadata?.model)?.metadata;
        const previousMessage = messages[messages.length - 2];
        const requestMessages =
          message.role === 'assistant' && previousMessage?.role === 'user'
            ? [previousMessage, message]
            : [message];

        const currentMcpTools = mcpToolsRef.current;
        const currentSkills = loadedSkillsRef.current;
        const currentSkillContext = skillContextRef.current;
        const skillCatalog = currentSkillContext?.availableSkills.map((s) => ({
          name: s.name,
          ...(s.description ? { description: s.description } : {}),
        }));
        return {
          body: {
            id: sessionId,
            messages: requestMessages,
            mode: message.metadata?.mode ?? metadata?.mode,
            model: message.metadata?.model ?? metadata?.model,
            ...(Object.keys(currentMcpTools).length > 0 ? { mcpTools: currentMcpTools } : {}),
            ...(currentSkills.length > 0 ? { skills: currentSkills } : {}),
            ...(skillCatalog && skillCatalog.length > 0 ? { skillCatalog } : {}),
          },
        };
      },
    });
  }, [sessionId]);

  const chat = useAiChat<Message>({
    id: sessionId,
    messages: initialMessages,
    transport,
    onToolCall({ toolCall }) {
      const mode = chat.messages.at(-1)?.metadata?.mode ?? 'AGENT';

      if (
        requiresToolApproval(toolCall.toolName, mode) &&
        !hasApprovedToolCall(chat.messages, toolCall.toolCallId)
      ) {
        return;
      }

      if (toolCall.toolName === 'loadSkill') {
        const { name } = toolCall.input as { name: string };
        const ctx = skillContextRef.current;
        const skill = ctx?.availableSkills.find((s) => s.name === name);
        if (!skill) {
          void chat.addToolOutput({
            tool: 'loadSkill' as keyof ChatTools,
            toolCallId: toolCall.toolCallId,
            state: 'output-error',
            errorText: `Skill "${name}" not found. Available: ${ctx?.availableSkills.map((s) => s.name).join(', ') ?? 'none'}`,
          });
          return;
        }
        ctx?.toggleSkill(name);
        void chat.addToolOutput({
          tool: 'loadSkill' as keyof ChatTools,
          toolCallId: toolCall.toolCallId,
          output: { name: skill.name, content: skill.content },
        });
        return;
      }

      const executeTool = mcpManager.isMcpTool(toolCall.toolName)
        ? mcpManager.executeTool(toolCall.toolName, toolCall.input)
        : executeLocalTool(toolCall.toolName, toolCall.input, mode);

      void executeTool
        .then((output) =>
          chat.addToolOutput({
            tool: toolCall.toolName as keyof ChatTools,
            toolCallId: toolCall.toolCallId,
            output,
          }),
        )
        .catch((error) =>
          chat.addToolOutput({
            tool: toolCall.toolName as keyof ChatTools,
            toolCallId: toolCall.toolCallId,
            state: 'output-error',
            errorText: error instanceof Error ? error.message : String(error),
          }),
        );
    },
    sendAutomaticallyWhen(params) {
      return (
        lastAssistantMessageIsCompleteWithToolCalls(params) ||
        lastAssistantMessageIsCompleteWithDeniedApproval(params)
      );
    },
  });

  const submit = useCallback(
    (params: { userText: string; mode: ModeType; model: SupportedChatModelId }) => {
      return chat.sendMessage({
        text: params.userText,
        metadata: {
          mode: params.mode,
          model: params.model,
        },
      });
    },
    [chat],
  );

  const approveTool = useCallback(
    async (approvalId: string) => {
      const approvalRequest = findApprovalRequest(chat.messages, approvalId);
      await chat.addToolApprovalResponse({ id: approvalId, approved: true });

      if (!approvalRequest) return;

      const toolName = getToolName(approvalRequest.part);
      const mode = approvalRequest.message.metadata?.mode ?? 'AGENT';

      try {
        const output = await executeLocalTool(toolName, approvalRequest.part.input, mode);
        await chat.addToolOutput({
          tool: toolName as keyof ChatTools,
          toolCallId: approvalRequest.part.toolCallId,
          output,
        });
      } catch (error) {
        await chat.addToolOutput({
          tool: toolName as keyof ChatTools,
          toolCallId: approvalRequest.part.toolCallId,
          state: 'output-error',
          errorText: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [chat],
  );

  const denyTool = useCallback(
    (approvalId: string, reason = 'User denied the tool call') => {
      return chat.addToolApprovalResponse({ id: approvalId, approved: false, reason });
    },
    [chat],
  );

  return {
    messages: chat.messages,
    status: chat.status,
    error: chat.error,
    submit,
    approveTool,
    denyTool,
    abort: chat.stop,
    interrupt: chat.stop,
  };
}
