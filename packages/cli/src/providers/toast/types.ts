export type ToastVariant = 'info' | 'success' | 'error';

export type ToastOptions = {
  variant?: ToastVariant;
  message: string;
  duration?: number;
};

export const DEAFAULT_TOAST_DURATION = 3000; // 3 seconds
