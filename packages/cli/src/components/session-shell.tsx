import { TextAttributes } from '@opentui/core';
import type { ReactNode } from 'react';
import { InputBar } from './input-bar';
import { Spinner } from './spinner';

type SessionShellProps = {
  children?: ReactNode;
  onSubmit: (text: string) => void;
  inputDisabled?: boolean;
  loading?: boolean;
};

export function SessionShell({
  children,
  onSubmit,
  inputDisabled = false,
  loading = false,
}: SessionShellProps) {
  return (
    <box flexDirection="column" width="100%" height="100%" paddingX={2} paddingY={1} gap={1}>
      <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="bottom">
        <box gap={1}>{children}</box>
      </scrollbox>
      <box flexShrink={0}>
        <InputBar onSubmit={onSubmit} disabled={inputDisabled} />
      </box>
      <box
        flexShrink={0}
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={1}
        gap={2}
        height={1}
        width="100%"
      >
        <box flexDirection="row" gap={2} alignItems="center">
            {loading ? <Spinner /> : null}
        </box>
        <box flexDirection="row" gap={1} flexShrink={0} marginLeft="auto">
            <text>tab</text>
            <text attributes={TextAttributes.DIM}>agents</text>
        </box>
      </box>
    </box>
  );
}
