import { TextAttributes } from '@opentui/core';
import { useTheme } from '../../providers/theme';
import type { ClientMessagePart } from '../../hooks/use-chat';
import { Mode } from '@sora/database/enums';

type BotMessageProps = {
  parts: ClientMessagePart[];
  model: string;
  mode: Mode;
  duration?: string;
  streaming?: boolean;
  interrupted?: boolean;
};

export function BotMessage({
  parts,
  model,
  mode,
  duration,
  streaming = false,
  interrupted = false,
}: BotMessageProps) {
  const { colors } = useTheme();
  const text = parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('');

  return (
    <box width="100%" alignItems="center">
      <box paddingY={1} width="100%">
        <box paddingX={3} width="100%">
          <text>{text}</text>
        </box>
      </box>
      <box paddingX={3} paddingBottom={1} width="100%" gap={1}>
        <box flexDirection="row" gap={2}>
          <text
            attributes={interrupted ? TextAttributes.DIM : 0}
            fg={interrupted ? undefined : mode === Mode.ASK ? colors.askMode : colors.primary}
          >{`\u25C9`}</text>
          <box flexDirection="row" gap={1}>
            <text attributes={interrupted ? TextAttributes.DIM : 0}>
              {mode === Mode.ASK ? 'ASK' : 'Agent'}
            </text>
            <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
              {'\u203A'}
            </text>
            <text attributes={TextAttributes.DIM}>{model}</text>
            {(interrupted || duration) && (
              <>
                <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
                  {'\u203A'}
                </text>
                <text attributes={TextAttributes.DIM}>
                  {interrupted ? 'interrupted' : duration}
                </text>
              </>
            )}
          </box>
        </box>
      </box>
    </box>
  );
}
