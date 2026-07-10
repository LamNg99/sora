import { TextAttributes } from '@opentui/core';
import { useTheme } from '../providers/theme';

export function StatusBar() {
  const { colors } = useTheme();

  return (
    <box flexDirection="row" gap={1}>
      <text fg={colors.primary}>Agent</text>
      <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
        {'\u203A'}
      </text>
      <text>opus-4-6</text>
    </box>
  );
}
