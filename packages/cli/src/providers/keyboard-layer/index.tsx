import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { useKeyboard, useRenderer } from '@opentui/react';

type Responder = () => boolean;

type KeyboardLayerContextType = {
  push: (id: string, responder?: Responder) => void;
  pop: (id: string) => void;
  isTopLayer: (id: string) => boolean;
  setResponder: (id: string, responder?: Responder | null) => void;
};

const KeyboardLayerContext = createContext<KeyboardLayerContextType | null>(null);

export function KeyboardLayerProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<string[]>(['base']);
  const responders = useRef<Map<string, Responder>>(new Map());
  const renderer = useRenderer();

  const push = useCallback((id: string, responder?: Responder) => {
    if (responder) {
      responders.current.set(id, responder);
    }

    setStack((prev) => {
      if (prev.includes(id)) {
        return prev;
      }

      return [...prev, id];
    });
  }, []);

  const pop = useCallback((id: string) => {
    responders.current.delete(id);
    setStack((prev) => prev.filter((layer) => layer !== id));
  }, []);

  const isTopLayer = useCallback(
    (id: string) => {
      return stack.length === 0 || stack[stack.length - 1] === id;
    },
    [stack],
  );

  const setResponder = useCallback((id: string, responder?: Responder | null) => {
    if (responder) {
      responders.current.set(id, responder);
    } else {
      responders.current.delete(id);
    }
  }, []);

  useKeyboard((key) => {
    if (key.name === 'escape') {
      for (let i = stack.length - 1; i >= 0; i--) {
        const layerId = stack[i]!;
        const responder = responders.current.get(layerId);
        if (responder && responder()) {
          key.preventDefault();
          return;
        }
      }
    }

    if (key.ctrl && key.name === 'c') {
      renderer.destroy();
    }
  });

  return (
    <KeyboardLayerContext.Provider
      value={{
        push,
        pop,
        isTopLayer,
        setResponder,
      }}
    >
      {children}
    </KeyboardLayerContext.Provider>
  );
}

export function useKeyboardLayer() {
  const context = useContext(KeyboardLayerContext);
  if (!context) {
    throw new Error('useKeyboardLayer must be used within a KeyboardLayerProvider');
  }

  return context;
}
