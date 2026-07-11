import { resolve, relative } from 'path';
import { tool } from 'ai';
import { z } from 'zod';

const MAX_MATCH = 50;

export function createGrepTool(cwd: string) {
  return tool({
    description:
      'Search file contents using a regex pattern. Return matching lines with file paths and line numbers. Skips hidden directories, node_modules, and binary files.',
    inputSchema: z.object({
      pattern: z.string().describe('Regex pattern to search for'),
      path: z
        .string()
        .describe('Relative directory to search in (defaults to project root)')
        .default('.'),
      include: z.string().describe('Glob pattern to filter files (e.g. "*.ts", "*.tsx")'),
    }),
    execute: async ({ pattern, path, include }) => {
      const resolved = resolve(cwd, path);

      if (!resolved.startsWith(cwd)) {
        return { error: 'Path is outside the project directory' };
      }

      try {
        const args = ['-rn', '--color=never', 'exclude-dir=.git', 'exclude-dir=node_modules', '-E'];

        if (include) {
          args.push(`--include=${include}`);
        }

        const proc = Bun.spawn(['grep', ...args], {
          stdout: 'pipe',
          stderr: 'pipe',
          cwd,
        });

        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();

        await proc.exited;

        if (proc.exitCode !== 0 && proc.exitCode !== 1) {
          return { error: `grep failed: ${stderr.trim()}` };
        }

        if (!stdout.trim()) {
          return { matches: [], result: 'No matches found' };
        }

        const lines = stdout.trim().split('\n');
        const matches: { file: string; line: number; content: string }[] = [];
        let truncate = false;

        for (const line of lines) {
          if (matches.length >= MAX_MATCH) {
            truncate = true;
            break;
          }

          const match = line.match(/^(.+?):(\d+):(.*)$/);
          if (match) {
            matches.push({
              file: relative(cwd, match[1]!),
              line: parseInt(match[2]!, 10),
              content: match[3]!,
            });
          }
        }

        return {
          matches,
          ...(truncate ? { truncated: true, totalMatches: lines.length } : {}),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { error: `Failed to execute command: ${message}` };
      }
    },
  });
}
