import { TextAttributes } from '@opentui/core';
import { useTheme } from '../../providers/theme';

type BotMessageProps = {
  content: string;
  model: string;
};

export function BotMessage({ content, model }: BotMessageProps) {
  const { colors } = useTheme();

  return (
    <box width="100%" alignItems="center">
      <box paddingY={1} width="100%">
        <box paddingX={3} width="100%">
          <text>{content}</text>
        </box>
      </box>
      <box paddingX={3} paddingBottom={1} width="100%" gap={1}>
        <box flexDirection="row" gap={2}>
          <text fg={colors.primary}>{`\u25C9`}</text>
          <text>{model}</text>
        </box>
      </box>
    </box>
  );
}
