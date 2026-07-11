import { TextAttributes } from '@opentui/core';
import { useTheme } from '../providers/theme';
import { usePromptConfig } from '../providers/prompt-config';
import { Mode } from '@sora/database/enums';

export function StatusBar() {
  const { mode, model } = usePromptConfig();
  const { colors } = useTheme();

  return (
    <box flexDirection="row" gap={1}>
      <text fg={mode === Mode.AGENT ? colors.primary : colors.askMode}>
        {mode === Mode.AGENT ? 'Agent' : 'Ask'}
      </text>
      <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
        {'\u203A'}
      </text>
      <text>{model}</text>
    </box>
  );
}
