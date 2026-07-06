import { TextAttributes } from '@opentui/core';
import { useTheme } from '../../providers/theme';

type ErrorMessageProps = {
  message: string;
};

export function ErrorMessage({ message }: ErrorMessageProps) {
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
