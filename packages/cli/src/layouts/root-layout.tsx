import { Outlet } from 'react-router';
import { DialogProvider } from '../providers/dialog';
import { ToastProvider } from '../providers/toast';
import { KeyboardLayerProvider } from '../providers/keyboard-layer';
import { ThemeProvider } from '../providers/theme';
import { ThemeRoot } from './themed-root';
import { PromptConfigProvider } from '../providers/prompt-config';

export function RootLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <KeyboardLayerProvider>
          <DialogProvider>
            <PromptConfigProvider>
              <ThemeRoot>
                <Outlet />
              </ThemeRoot>
            </PromptConfigProvider>
          </DialogProvider>
        </KeyboardLayerProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
