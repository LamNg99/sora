import { mkdir, readFile, readdir, stat, writeFile } from 'fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { toolInputSchema, Mode, type ModeType } from '@sora/shared';

const MAX_FILE_SIZE = 10_000_000; // 10 MB
const MAX_RESULTS = 200;
const MAX_MATCHES = 50;
const MAX_OUTPUT = 20_000;
const DEFAULT_TIMEOUT = 30_000; // 30 seconds

function resolveInsideCwd(path: string) {
  const cwd = process.cwd();
  const resolved = resolve(cwd, path);
  const rel = relative(cwd, resolved);

  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Path ${path} is outside the current working directory`);
  }
  return { cwd, resolved };
}

function truncate(value: string, limit: number) {
  return value.length > limit
    ? `${value.slice(0, limit)}\n... (truncated, ${value.length} total chars)`
    : value;
}

export async function executeLocalTool(toolName: string, input: unknown, mode: ModeType) {
  if (mode === Mode.ASK && !['readFile', 'listDirectory', 'glob', 'grep'].includes(toolName)) {
    throw new Error(`Tool ${toolName} is not allowed in ASK mode`);
  }

  switch (toolName) {
    case 'readFile': {
      const { path } = toolInputSchema.readFile.parse(input);
      const { resolved } = resolveInsideCwd(path);
      const content = await readFile(resolved, 'utf-8');
      return content.length > MAX_FILE_SIZE
        ? { content: content.slice(0, MAX_FILE_SIZE), truncated: true, totalLength: content.length }
        : { content };
    }
    case 'listDirectory': {
      const { path } = toolInputSchema.listDirectory.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);
      const entries = await readdir(resolved);
      const result: { name: string; type: 'file' | 'directory' }[] = [];

      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue; // skip hidden files
        const info = await stat(join(resolved, entry));
        result.push({
          name: entry,
          type: info.isDirectory() ? 'directory' : 'file',
        });
      }

      result.sort((a, b) =>
        a.type !== b.type ? (a.type === 'directory' ? -1 : 1) : a.name.localeCompare(b.name),
      );
      return { path: relative(cwd, resolved) || '.', entries: result };
    }
    case 'glob': {
      const { pattern, path } = toolInputSchema.glob.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);
      const glob = new Bun.Glob(pattern);
      const files: string[] = [];
      let truncated = false;

      for await (const match of glob.scan({ cwd: resolved, dot: false, onlyFiles: true })) {
        if (match.includes('node_modules')) continue; // skip node_modules
        if (files.length >= MAX_RESULTS) {
          truncated = true;
          break;
        }
        files.push(relative(cwd, resolve(resolved, match)));
      }

      files.sort();
      return { files, ...(truncated ? { truncated: true } : {}) };
    }
    case 'grep': {
      const { pattern, path, include } = toolInputSchema.grep.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);
      const args = [
        '-rn',
        '--color=never',
        '--exclude-dir=node_modules',
        '--exclude-dir=.git',
        '-E',
      ];

      if (include) args.push(`--include=${include}`);
      args.push(pattern, resolved);

      const proc = Bun.spawn(['grep', ...args], {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exitCode = await proc.exited;

      if (exitCode !== 0 && exitCode !== 1)
        throw new Error(`grep failed: ${exitCode}: ${stderr.trim()}`);
      if (!stdout.trim()) return { matches: [], message: 'No matches found' };

      const lines = stdout.trim().split('\n');
      const matches: { file: string; line: number; text: string }[] = [];
      let truncated = false;

      for (const line of lines) {
        if (matches.length >= MAX_MATCHES) {
          truncated = true;
          break;
        }
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        if (match) {
          matches.push({
            file: relative(cwd, resolve(resolved, match[1]!)),
            line: parseInt(match[2]!, 10),
            text: match[3]!,
          });
        }
      }
      return { matches, ...(truncated ? { truncated: true, totalMatches: lines.length } : {}) };
    }
    case 'writeFile': {
      const { path, content } = toolInputSchema.writeFile.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);
      await mkdir(dirname(resolved), { recursive: true });
      await writeFile(resolved, content, 'utf-8');
      return {
        success: true as const,
        path: relative(cwd, resolved),
        bytesWritten: Buffer.byteLength(content, 'utf-8'),
      };
    }
    case 'editFile': {
      const { path, oldString, newString } = toolInputSchema.editFile.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);
      const content = await readFile(resolved, 'utf-8');
      const occurrences = content.split(oldString).length - 1;

      if (occurrences === 0) throw new Error(`oldString not found in file`);
      if (occurrences > 1) throw new Error(`oldString is ambiguous; found ${occurrences} matches`);

      await writeFile(resolved, content.replace(oldString, newString), 'utf-8');
      return {
        success: true as const,
        path: relative(cwd, resolved),
      };
    }
    case 'bash': {
      const { command, timeout = DEFAULT_TIMEOUT } = toolInputSchema.bash.parse(input);
      const proc = Bun.spawn(['bash', '-c', command], {
        cwd: resolveInsideCwd('.').resolved,
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, TERM: 'dumb' },
      });
      const timer = setTimeout(() => proc.kill(), timeout);
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exitCode = await proc.exited;
      clearTimeout(timer);
      return {
        stdout: truncate(stdout, MAX_OUTPUT),
        stderr: truncate(stderr, MAX_OUTPUT),
        exitCode,
      };
    }
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
