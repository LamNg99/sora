import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DEFAULT_CHAT_MODEL_ID,
  Mode,
  type LoadedSkill,
  type SupportedChatModelId,
  type ModeType,
} from '@sora/shared';
import { loadAvailableSkills, type Skill } from '../../lib/skills';

type PromptContextConfigValue = {
  mode: ModeType;
  model: SupportedChatModelId;
  setMode: (mode: ModeType) => void;
  setModel: (model: SupportedChatModelId) => void;
  toggleMode: () => void;
  availableSkills: Skill[];
  loadedSkillNames: Set<string>;
  loadedSkills: LoadedSkill[];
  toggleSkill: (name: string) => void;
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
  const [availableSkills] = useState<Skill[]>(() => loadAvailableSkills());
  const [loadedSkillNames, setLoadedSkillNames] = useState<Set<string>>(new Set());

  const toggleMode = () => {
    setMode((prevMode) => (prevMode === Mode.AGENT ? Mode.ASK : Mode.AGENT));
  };

  const toggleSkill = (name: string) => {
    setLoadedSkillNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const loadedSkills: LoadedSkill[] = availableSkills
    .filter((s) => loadedSkillNames.has(s.name))
    .map((s) => ({ name: s.name, content: s.content }));

  return (
    <PromptConfigContext.Provider
      value={{
        mode,
        model,
        setMode,
        setModel,
        toggleMode,
        availableSkills,
        loadedSkillNames,
        loadedSkills,
        toggleSkill,
      }}
    >
      {children}
    </PromptConfigContext.Provider>
  );
}
