import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DEFAULT_CHAT_MODEL_ID,
  Mode,
  type SupportedChatModelId,
  type ModeType,
} from '@sora/shared';

type PromptContextConfigValue = {
  mode: ModeType;
  model: SupportedChatModelId;
  setMode: (mode: ModeType) => void;
  setModel: (model: SupportedChatModelId) => void;
  toggleMode: () => void;
};

const PromptConfigContext = createContext<PromptContextConfigValue | null>(null);

export function usePromptConfig(): PromptContextConfigValue {
  const value = useContext(PromptConfigContext);
  if (!value) {
    throw new Error('usePromptConfig must be used within a PromptConfigProvider');
  }
  return value;
}

type PromptConfigProviderProps = {
  children: ReactNode;
};

export function PromptConfigProvider({ children }: PromptConfigProviderProps) {
  const [mode, setMode] = useState<ModeType>(Mode.AGENT);
  const [model, setModel] = useState<SupportedChatModelId>(DEFAULT_CHAT_MODEL_ID);

  const toggleMode = () => {
    setMode((prevMode) => (prevMode === Mode.AGENT ? Mode.ASK : Mode.AGENT));
  };

  return (
    <PromptConfigContext.Provider value={{ mode, model, setMode, setModel, toggleMode }}>
      {children}
    </PromptConfigContext.Provider>
  );
}
