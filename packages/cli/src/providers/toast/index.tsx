import { createContext, useContext, useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTerminalDimensions } from '@opentui/react';
import type { ToastOptions, ToastVariant } from './types';
import { DEAFAULT_TOAST_DURATION } from './types';

export type ToastContextType = {
  show: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return value;
}

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [currentToast, setCurrentToast] = useState<ToastOptions | null>(null);
  const timeoutHandleRef = useRef<NodeJS.Timeout | null>(null);

  const clearCurrentTimeout = useCallback(() => {
    if (timeoutHandleRef.current) {
      clearTimeout(timeoutHandleRef.current);
      timeoutHandleRef.current = null;
    }
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      const duration = options.duration ?? DEAFAULT_TOAST_DURATION;

      clearCurrentTimeout();

      setCurrentToast({
        variant: options.variant ?? 'info',
        ...options,
        duration,
      });

      timeoutHandleRef.current = setTimeout(() => {
        setCurrentToast(null);
      }, duration).unref();
    },
    [clearCurrentTimeout],
  );

  const value: ToastContextType = {
    show,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast currentToast={currentToast} />
    </ToastContext.Provider>
  );
}

type ToastProps = {
  currentToast: ToastOptions | null;
};

function Toast({ currentToast }: ToastProps) {
  const { width } = useTerminalDimensions();

  if (!currentToast) {
    return null;
  }

  const variantColors: Record<ToastVariant, string> = {
    info: '#56D6C2',
    success: '#82E0AA',
    error: '#E74C5E',
  };

  const borderColor = currentToast.variant
    ? variantColors[currentToast.variant]
    : variantColors.info;

  return (
    <box
      position="absolute"
      justifyContent="center"
      alignItems="center"
      top={2}
      right={2}
      width={Math.max(1, Math.min(60, width - 6))}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      backgroundColor="#1A1A24"
      borderColor={borderColor}
      border={['left', 'right']}
    >
      <box flexDirection="column" width="100%" gap={1}>
        <text fg="E1E1E1" wrapMode="word" width="100%">
          {currentToast.message}
        </text>
      </box>
    </box>
  );
}
