import prettyMs from 'pretty-ms';
import { TextAttributes } from '@opentui/core';
import { useTheme } from '../../providers/theme';
import type { Message } from '../../hooks/use-chat';
import { Mode, type ModeType } from '@sora/shared';

type ClientMessagePart = Message['parts'][number];
type ClientToolCallPart = Extract<ClientMessagePart, { type: `tool-${string}` | 'dynamic-tool' }>;

type BotMessageProps = {
  parts: ClientMessagePart[];
  model: string;
  mode: ModeType;
  durationMs?: number;
  streaming?: boolean;
};

function formatToolName(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

function isToolPart(part: ClientMessagePart): part is ClientToolCallPart {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-');
}

function formatToolArgs(tc: ClientToolCallPart): string {
  if (!('input' in tc) || tc.input == null) return '';
  if (typeof tc.input !== 'object') return String(tc.input);
  return Object.values(tc.input).map(String).join(' ');
}

type PartGroup = {
  type: ClientMessagePart['type'];
  parts: ClientMessagePart[];
  key: string;
};

function groupConsecutiveParts(parts: ClientMessagePart[]): PartGroup[] {
  const groups: PartGroup[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.type === part.type) {
      lastGroup.parts.push(part);
    } else {
      const key = isToolPart(part) ? `group-tc-${part.toolCallId}` : `group-${part.type}-${i}`;
      groups.push({ type: part.type, parts: [part], key });
    }
  }

  return groups;
}

export function BotMessage({ parts, model, mode, durationMs, streaming = false }: BotMessageProps) {
  const { colors } = useTheme();

  return (
    <box width="100%" alignItems="center">
      {groupConsecutiveParts(parts).map((group) => (
        <box key={group.key} width="100%">
          {group.parts.map((part, i) => {
            if (part.type === 'reasoning') {
              return (
                <box key={`reasoning-${i}`} width="100%" paddingX={2}>
                  <text attributes={TextAttributes.DIM}>
                    <em fg={colors.thinking}>Thinking:</em> {part.text}
                  </text>
                </box>
              );
            }
            if (isToolPart(part)) {
              const toolName =
                part.type === 'dynamic-tool' ? part.toolName : part.type.slice('tool-'.length);
              return (
                <box key={part.toolCallId} width="100%" paddingX={2}>
                  <text attributes={TextAttributes.DIM}>
                    <em fg={colors.info}>{formatToolName(toolName)}:</em> {formatToolArgs(part)}
                    {part.state !== 'output-available' && part.state !== 'output-error'
                      ? ' ...'
                      : ''}
                    {part.state === 'output-error' ? ` ${part.errorText})` : ''}
                  </text>
                </box>
              );
            }
            if (part.type === 'text') {
              return (
                <box key={`text-${i}`} width="100%" paddingX={3}>
                  <text>{part.text}</text>
                </box>
              );
            }
            return null;
          })}
        </box>
      ))}
      <box paddingX={3} paddingY={1} width="100%" gap={1}>
        <box flexDirection="row" gap={2}>
          <text fg={mode === Mode.ASK ? colors.askMode : colors.primary}>{`\u25C9`}</text>
          <box flexDirection="row" gap={1}>
            <text>{mode === Mode.ASK ? 'ASK' : 'Agent'}</text>
            <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
              {'\u203A'}
            </text>
            <text attributes={TextAttributes.DIM}>{model}</text>
            {durationMs != null && (
              <>
                <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
                  {'\u203A'}
                </text>
                <text attributes={TextAttributes.DIM}>{prettyMs(durationMs)}</text>
              </>
            )}
          </box>
        </box>
      </box>
    </box>
  );
}
