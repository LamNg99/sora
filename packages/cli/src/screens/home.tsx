import { useNavigate } from 'react-router';
import { useCallback } from 'react';
import { InputBar } from '../components/input-bar';
import { Header } from '../components/header';
import { usePromptConfig } from '../providers/prompt-config';
import { TextAttributes } from '@opentui/core';

export function Home() {
  const navigation = useNavigate();
  const { mode, model } = usePromptConfig();

  const handleSubmit = useCallback(
    (text: string) => {
      navigation('/sessions/new', { state: { message: text, mode, model } });
    },
    [navigation, mode, model],
  );

  return (
    <box
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      gap={2}
      position="relative"
      width="100%"
      height="100%"
    >
      <Header />
      <box width="100%" maxWidth={78} paddingX={2} flexDirection="column" gap={1}>
        <InputBar onSubmit={handleSubmit} />
        <box flexDirection="row" gap={1} flexShrink={0} marginLeft="auto">
          <text>tab</text>
          <text attributes={TextAttributes.DIM}>agents</text>
        </box>
      </box>
    </box>
  );
}
