import { TextAttributes } from '@opentui/core';
import { useTheme } from '../../providers/theme';
import type { ModeType } from '@sora/shared';

type UserMessageProps = {
  message: string;
  mode: ModeType;
};

export function UserMessage({ message, mode }: UserMessageProps) {
  const { colors } = useTheme();

  return (
    <box width="100%" alignItems="center">
      <box
        justifyContent="center"
        paddingX={2}
        paddingY={1}
        backgroundColor={colors.surface}
        width="100%"
      >
        <text attributes={TextAttributes.DIM}>{message}</text>
      </box>
    </box>
  );
}
