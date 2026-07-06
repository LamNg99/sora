import { useNavigate } from 'react-router';
import { useCallback } from 'react';
import { InputBar } from '../components/input-bar';
import { Header } from '../components/header';

export function Home() {
  const navigation = useNavigate();

  const handleSubmit = useCallback(
    (text: string) => {
      navigation('/sessions/new', { state: { message: text } });
    },
    [navigation],
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
      <box width="100%" maxWidth={78} paddingX={2}>
        <InputBar onSubmit={handleSubmit} />
      </box>
    </box>
  );
}
