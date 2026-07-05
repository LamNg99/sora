import { createContext, useContext, useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTerminalDimensions } from '@opentui/react';
import type { ToastOptions } from './types';
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
