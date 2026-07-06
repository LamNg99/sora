import { Outlet } from 'react-router';
import { DialogProvider } from '../providers/dialog';
import { ToastProvider } from '../providers/toast';
import { KeyboardLayerProvider } from '../providers/keyboard-layer';
import { ThemeProvider } from '../providers/theme';
import { ThemeRoot } from './themed-root';

export function RootLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <KeyboardLayerProvider>
          <DialogProvider>
            <ThemeRoot>
              <Outlet />
            </ThemeRoot>
          </DialogProvider>
        </KeyboardLayerProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
