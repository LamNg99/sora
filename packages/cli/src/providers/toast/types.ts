export type ToastType = 'info' | 'success' | 'error';

export type ToastOptions = {
  type: ToastType;
  message: string;
  duration?: number;
};

export const DEAFAULT_TOAST_DURATION = 3000; // 3 seconds
