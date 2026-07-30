import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { useKeyboard } from '@opentui/react';
import { DialogProvider } from '../providers/dialog';
import { ToastProvider } from '../providers/toast';
import { KeyboardLayerProvider } from '../providers/keyboard-layer';
import { ThemeProvider } from '../providers/theme';
import { ThemeRoot } from './themed-root';
import { PromptConfigProvider } from '../providers/prompt-config';
import { mcpManager } from '../lib/mcp-manager';

export function RootLayout() {
  useEffect(() => {
    void mcpManager.initialize();
  }, []);

  useKeyboard((key) => {
    if (key.sequence === '\x03' || (key.ctrl && key.name === 'c')) {
      process.exit(0);
    }
  });

  return (
    <ThemeProvider>
      <ToastProvider>
        <KeyboardLayerProvider>
          <PromptConfigProvider>
            <DialogProvider>
              <ThemeRoot>
                <Outlet />
              </ThemeRoot>
            </DialogProvider>
          </PromptConfigProvider>
        </KeyboardLayerProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
