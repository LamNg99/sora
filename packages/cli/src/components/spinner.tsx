import 'opentui-spinner/react';
import { useTheme } from '../providers/theme';
import { Mode } from '@sora/database/enums';

type SpinnerProps = {
  mode: Mode;
};

export function Spinner({ mode }: SpinnerProps) {
  const { colors } = useTheme();
  const activeColor = mode === Mode.ASK ? colors.askMode : colors.primary;

  return <spinner name="star" color={activeColor} />;
}
