import {
  ThemeDialogContent,
  SessionsDialogContent,
  AgentsDialogContent,
  ModelsDialogContent,
} from '../../dialogs';
import { SUPPORTED_CHAT_MODELS } from '@sora/shared';
import type { Command } from './types';
import { performLogin } from '../../lib/oauth';
import { clearAuth } from '../../lib/auth';
import { openBillingPortal, openUpgradeCheckout } from '../../lib/upgrade';

export const COMMANDS: Command[] = [
  {
    name: 'new',
    description: 'Start a new conversation',
    value: '/new',
    action: (ctx) => {
      ctx.navigate('/');
    },
  },
  {
    name: 'agents',
    description: 'Switch agents',
    value: '/agents',
    action: (ctx) => {
      ctx.dialog.open({
        title: 'Select Mode',
        children: <AgentsDialogContent currentMode={ctx.mode} onSelectMode={ctx.setMode} />,
      });
    },
  },
  {
    name: 'models',
    description: 'Switch models',
    value: '/models',
    action: (ctx) => {
      ctx.dialog.open({
        title: 'Select Model',
        children: (
          <ModelsDialogContent
            models={SUPPORTED_CHAT_MODELS.map((model) => model.id)}
            onSelectModel={ctx.setModel}
          />
        ),
      });
    },
  },
  {
    name: 'sessions',
    description: 'Switch sessions',
    value: '/sessions',
    action: (ctx) => {
      ctx.dialog.open({
        title: 'Select Session',
        children: <SessionsDialogContent />,
      });
    },
  },
  {
    name: 'theme',
    description: 'Change color theme',
    value: '/theme',
    action: (ctx) => {
      ctx.dialog.open({
        title: 'Select Theme',
        children: <ThemeDialogContent />,
      });
    },
  },
  {
    name: 'login',
    description: 'Log in with your browser',
    value: '/login',
    action: async (ctx) => {
      ctx.toast.show({ message: 'Opening browser for login...' });
      try {
        await performLogin();
        ctx.toast.show({ variant: 'success', message: 'Login successful!' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed or timed out.';
        ctx.toast.show({ variant: 'error', message });
      }
    },
  },
  {
    name: 'logout',
    description: 'Log out of your account',
    value: '/logout',
    action: async (ctx) => {
      clearAuth();
      ctx.toast.show({ variant: 'success', message: 'Logout successful!' });
    },
  },
  {
    name: 'upgrade',
    description: 'Buy more credits',
    value: '/upgrade',
    action: async (ctx) => {
      ctx.toast.show({ message: 'Opening credits checkout...' });
      try {
        await openUpgradeCheckout();
        ctx.toast.show({ variant: 'success', message: 'Checkout opened in browser' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open checkout.';
        ctx.toast.show({ variant: 'error', message });
      }
    },
  },
  {
    name: 'usage',
    description: 'Open billing portal in your browser',
    value: '/usage',
    action: async (ctx) => {
      ctx.toast.show({ message: 'Opening billing portal...' });
      try {
        await openBillingPortal();
        ctx.toast.show({ variant: 'success', message: 'Billing portal opened in browser' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open billing portal.';
        ctx.toast.show({ variant: 'error', message });
      }
    },
  },
  {
    name: 'exit',
    description: 'Exit the application',
    value: '/exit',
    action: (ctx) => {
      ctx.exit();
    },
  },
];
