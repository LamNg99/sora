import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { SessionShell } from '../components/session-shell';
import { ErrorMessage, UserMessage, BotMessage } from '../components/messages';

export function NewSession() {
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as { message?: string } | null;

  useEffect(() => {
    if (!state?.message) {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  if (!state?.message) return null;

  return (
    <SessionShell onSubmit={() => {}} inputDisabled loading>
      <UserMessage message={state.message} />
      <BotMessage content="Hello! How can I assist you today?" model="opus-4.6" />
      <ErrorMessage message="An error occurred while processing your request." />
    </SessionShell>
  );
}
