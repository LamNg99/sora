import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export type StdioMcpServerConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
};

export type OAuthMcpConfig = {
  clientId: string;
  clientSecret?: string;
  scope?: string;
};

export type HttpMcpServerConfig = {
  url: string;
  type?: 'http' | 'sse';
  headers?: Record<string, string>;
  oauth?: OAuthMcpConfig;
  disabled?: boolean;
};

export type McpServerConfig = StdioMcpServerConfig | HttpMcpServerConfig;

export type McpConfig = {
  mcpServers: Record<string, McpServerConfig>;
};

const SORA_DIR = join(homedir(), '.sora');
const MCP_CONFIG_FILE = join(SORA_DIR, 'mcp.json');

export function isHttpConfig(config: McpServerConfig): config is HttpMcpServerConfig {
  return 'url' in config;
}

export function loadMcpConfig(): McpConfig {
  if (!existsSync(MCP_CONFIG_FILE)) return { mcpServers: {} };
  try {
    const parsed = JSON.parse(readFileSync(MCP_CONFIG_FILE, 'utf-8')) as Partial<McpConfig>;
    return { mcpServers: parsed.mcpServers ?? {} };
  } catch {
    return { mcpServers: {} };
  }
}

export function saveMcpConfig(config: McpConfig): void {
  if (!existsSync(SORA_DIR)) mkdirSync(SORA_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(MCP_CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf-8' });
}

export function setServerDisabled(name: string, disabled: boolean): void {
  const config = loadMcpConfig();
  const server = config.mcpServers[name];
  if (!server) return;
  if (disabled) {
    server.disabled = true;
  } else {
    delete server.disabled;
  }
  saveMcpConfig(config);
}
