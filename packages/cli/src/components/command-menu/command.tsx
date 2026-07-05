import type { Command } from './types';

export const COMMANDS: Command[] = [
  {
    name: 'new',
    description: 'Start a new conversation',
    value: '/new',
    action: (ctx) => {
      ctx.toast.show({
        message: 'Starting a new conversation...',
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
