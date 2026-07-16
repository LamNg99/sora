import prettyMs from 'pretty-ms';
import { SyntaxStyle, TextAttributes } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useCallback, useMemo, useState } from 'react';
import { useTheme } from '../../providers/theme';
import { useKeyboardLayer } from '../../providers/keyboard-layer';
import type { Message } from '../../hooks/use-chat';
import { Mode, type ModeType } from '@sora/shared';

type ClientMessagePart = Message['parts'][number];
type ClientToolCallPart = Extract<ClientMessagePart, { type: `tool-${string}` | 'dynamic-tool' }>;

type ToolApprovalCallbacks = {
  onApproveTool?: (approvalId: string) => void;
  onDenyTool?: (approvalId: string) => void;
};

type BotMessageProps = ToolApprovalCallbacks & {
  parts: ClientMessagePart[];
  model: string;
  mode: ModeType;
  durationMs?: number;
  streaming?: boolean;
  activeApprovalId?: string;
};

function formatToolName(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

function isToolPart(part: ClientMessagePart): part is ClientToolCallPart {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-');
}

function truncateToolValue(value: string) {
  return value.length > 160 ? `${value.slice(0, 157)}...` : value;
}

function formatToolArgs(tc: ClientToolCallPart): string {
  if (!('input' in tc) || tc.input == null) return '';
  if (typeof tc.input !== 'object') return truncateToolValue(String(tc.input));
  return Object.values(tc.input).map((value) => truncateToolValue(String(value))).join(' ');
}

function getToolApproval(part: ClientToolCallPart) {
  return 'approval' in part ? part.approval : undefined;
}

function getToolStatus(part: ClientToolCallPart) {
  const approval = getToolApproval(part);

  switch (part.state) {
    case 'approval-requested':
      return approval?.isAutomatic ? 'approval requested automatically' : 'waiting for approval';
    case 'approval-responded':
      return approval?.approved
        ? 'approved'
        : `denied${approval?.reason ? `: ${approval.reason}` : ''}`;
    case 'output-denied':
      return `denied${approval?.reason ? `: ${approval.reason}` : ''}`;
    case 'output-error':
      return `error: ${part.errorText}`;
    case 'output-available':
      return '';
    default:
      return '...';
  }
}

type ToolApprovalOption = {
  label: string;
  value: 'approve' | 'deny';
};

const TOOL_APPROVAL_OPTIONS: ToolApprovalOption[] = [
  { label: 'Approve', value: 'approve' },
  { label: 'Deny', value: 'deny' },
];

type ToolApprovalListProps = ToolApprovalCallbacks & {
  approvalId: string;
  active: boolean;
};

function ToolApprovalList({ approvalId, active, onApproveTool, onDenyTool }: ToolApprovalListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { colors } = useTheme();
  const { isTopLayer } = useKeyboardLayer();

  const executeSelectedOption = useCallback(() => {
    const option = TOOL_APPROVAL_OPTIONS[selectedIndex];
    if (!option) return;

    if (option.value === 'approve') {
      onApproveTool?.(approvalId);
    } else {
      onDenyTool?.(approvalId);
    }
  }, [approvalId, onApproveTool, onDenyTool, selectedIndex]);

  useKeyboard((key) => {
    if (!active || !isTopLayer('base')) return;

    if (key.name === 'return' || key.name === 'enter') {
      key.preventDefault();
      executeSelectedOption();
    } else if (key.name === 'up' || key.name === 'left') {
      key.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (key.name === 'down' || key.name === 'right' || key.name === 'tab') {
      key.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, TOOL_APPROVAL_OPTIONS.length - 1));
    }
  });

  return (
    <box flexDirection="column" paddingLeft={2}>
      {TOOL_APPROVAL_OPTIONS.map((option, index) => {
        const isSelected = index === selectedIndex;
        return (
          <box
            key={option.value}
            flexDirection="row"
            gap={1}
            height={1}
            overflow="hidden"
            onMouseMove={() => setSelectedIndex(index)}
            onMouseDown={() => {
              if (option.value === 'approve') {
                onApproveTool?.(approvalId);
              } else {
                onDenyTool?.(approvalId);
              }
            }}
          >
            <text selectable={false} fg={colors.selected}>
              {isSelected ? '›' : ' '}
            </text>
            <text selectable={false} fg="white">
              {option.label}
            </text>
          </box>
        );
      })}
    </box>
  );
}

type PartGroup = {
  type: ClientMessagePart['type'];
  parts: ClientMessagePart[];
  key: string;
};

type MarkdownStyleOptions = {
  text: string;
  accent: string;
  muted: string;
  dim?: boolean;
};

function createMarkdownStyle({
  text,
  accent,
  muted,
  dim = false,
}: MarkdownStyleOptions): SyntaxStyle {
  return SyntaxStyle.fromStyles({
    default: { fg: text, dim },
    conceal: { fg: muted, dim: true },
    markup: { fg: muted, dim: true },
    'markup.heading': { fg: accent, bold: true },
    'markup.strong': { fg: text, bold: true, dim },
    'markup.italic': { fg: text, italic: true, dim },
    'markup.strikethrough': { fg: muted, dim: true },
    'markup.raw': { fg: accent, dim },
    'markup.link': { fg: muted, dim: true },
    'markup.link.label': { fg: accent, underline: true },
    'markup.link.url': { fg: muted, underline: true, dim: true },
    'markup.list': { fg: accent, bold: true },
    'markup.quote': { fg: muted, italic: true, dim: true },
    keyword: { fg: accent, bold: true },
    string: { fg: text, dim },
    comment: { fg: muted, italic: true, dim: true },
  });
}

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

export function BotMessage({
  parts,
  model,
  mode,
  durationMs,
  streaming = false,
  onApproveTool,
  onDenyTool,
  activeApprovalId,
}: BotMessageProps) {
  const { colors } = useTheme();
  const textMarkdownStyle = useMemo(
    () => createMarkdownStyle({ text: '#ffffff', accent: colors.info, muted: colors.dimSeparator }),
    [colors.dimSeparator, colors.info],
  );
  const reasoningMarkdownStyle = useMemo(
    () =>
      createMarkdownStyle({
        text: colors.thinking,
        accent: colors.thinking,
        muted: colors.dimSeparator,
        dim: true,
      }),
    [colors.dimSeparator, colors.thinking],
  );

  return (
    <box width="100%" alignItems="center">
      {groupConsecutiveParts(parts).map((group) => (
        <box key={group.key} width="100%">
          {group.parts.map((part, i) => {
            if (part.type === 'reasoning') {
              return (
                <box key={`reasoning-${i}`} width="100%" paddingX={2} paddingBottom={1}>
                  <text attributes={TextAttributes.DIM}>
                    <em fg={colors.thinking}>Thinking:</em>
                  </text>
                  <markdown
                    content={part.text}
                    syntaxStyle={reasoningMarkdownStyle}
                    fg={colors.thinking}
                    conceal
                    streaming={streaming}
                    width="100%"
                  />
                </box>
              );
            }
            if (isToolPart(part)) {
              const toolName =
                part.type === 'dynamic-tool' ? part.toolName : part.type.slice('tool-'.length);
              const approval = getToolApproval(part);
              const status = getToolStatus(part);
              const showApprovalControls =
                part.state === 'approval-requested' && approval?.id && !approval.isAutomatic;

              return (
                <box key={part.toolCallId} width="100%" paddingX={2} flexDirection="column" gap={1}>
                  <text attributes={TextAttributes.DIM}>
                    <em fg={colors.info}>{formatToolName(toolName)}:</em> {formatToolArgs(part)}
                    {status ? ` ${status}` : ''}
                  </text>
                  {showApprovalControls ? (
                    <ToolApprovalList
                      approvalId={approval.id}
                      active={activeApprovalId === approval.id}
                      onApproveTool={onApproveTool}
                      onDenyTool={onDenyTool}
                    />
                  ) : null}
                </box>
              );
            }
            if (part.type === 'text') {
              return (
                <box key={`text-${i}`} width="100%" paddingX={2}>
                  <markdown
                    content={part.text}
                    syntaxStyle={textMarkdownStyle}
                    fg="#ffffff"
                    conceal
                    concealCode
                    streaming={streaming}
                    width="100%"
                  />
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
