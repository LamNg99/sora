import type { ToastContextType } from '../../providers/toast';

export type CommandContext = {
  exit: () => void;
  toast: ToastContextType;
};

export type Command = {
  name: string;
  description: string;
  value: string;
  action?: (ctx: CommandContext) => void | Promise<void>;
};
