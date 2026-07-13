import { z } from 'zod';
import { tool } from 'ai';

export const Mode = {
  AGENT: 'AGENT',
  ASK: 'ASK',
} as const;

export const modeSchema = z.enum([Mode.AGENT, Mode.ASK]);

export type ModeType = (typeof Mode)[keyof typeof Mode];

export const toolInputSchema = {
  readFile: z.object({
    path: z.string().describe('Relative path to the file to read'),
  }),
  listDirectory: z.object({
    path: z.string().default('.').describe('Relative path to the directory to list'),
  }),
  glob: z.object({
    pattern: z.string().describe('Glob pattern to match files'),
    path: z.string().default('.').describe('Directory to search from'),
  }),
  grep: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z.string().default('.').describe('Directory to search from'),
    include: z.string().optional().describe('Optional glob for files to include'),
  }),
  writeFile: z.object({
    path: z.string().describe('Relative path to write'),
    content: z.string().describe('File contents'),
  }),
  editFile: z.object({
    path: z.string().describe('Relative path to edit'),
    oldString: z.string().describe('Exact text to replace; must be unique'),
    newString: z.string().describe('Replacement text'),
  }),
  bash: z.object({
    command: z.string().describe('Shell command to run'),
    description: z.string().optional().describe('Short description of the command'),
    timeout: z.number().optional().describe('Timeout in milliseconds'),
  }),
} as const;

export const readonlyToolContracts = {
  readFile: tool({
    description: 'Read a file from the current directory.',
    inputSchema: toolInputSchema.readFile,
  }),
  listDirectory: tool({
    description: 'List entries in a directory under the current project directory.',
    inputSchema: toolInputSchema.listDirectory,
  }),
  glob: tool({
    description: 'Find files matching a glob pattern under the current project directory.',
    inputSchema: toolInputSchema.glob,
  }),
  grep: tool({
    description: 'Search file contents for a regex pattern under the current project directory.',
    inputSchema: toolInputSchema.grep,
  }),
} as const;

export const agentToolContracts = {
  ...readonlyToolContracts,
  writeFile: tool({
    description: 'Write or overwrite a file under the current project directory.',
    inputSchema: toolInputSchema.writeFile,
  }),
  editFile: tool({
    description: 'Replace exact text in a file under the current project directory.',
    inputSchema: toolInputSchema.editFile,
  }),
  bash: tool({
    description: 'Run a shell command in the current project directory.',
    inputSchema: toolInputSchema.bash,
  }),
} as const;

export type ToolContracts = typeof agentToolContracts;

export function getToolContracts(mode: ModeType) {
  return mode === Mode.AGENT ? agentToolContracts : readonlyToolContracts;
}
