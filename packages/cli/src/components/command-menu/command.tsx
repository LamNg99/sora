import {
  ThemeDialogContent,
  SessionsDialogContent,
  AgentsDialogContent,
  ModelsDialogContent,
} from '../../dialogs';
import { SUPPORTED_CHAT_MODELS } from '@sora/shared';
import type { Command } from './types';

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
    name: 'exit',
    description: 'Exit the application',
    value: '/exit',
    action: (ctx) => {
      ctx.exit();
    },
  },
];
