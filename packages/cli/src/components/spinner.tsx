import 'opentui-spinner/react';
import { useTheme } from '../providers/theme';
import type { ModeType } from '@sora/shared';

type SpinnerProps = {
  mode: ModeType;
};

export function Spinner({ mode }: SpinnerProps) {
  const { colors } = useTheme();
  const activeColor = mode === 'ASK' ? colors.askMode : colors.primary;

  return <spinner name="star" color={activeColor} />;
}
