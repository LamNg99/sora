import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport as StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { loadMcpConfig, isHttpConfig, setServerDisabled, type McpServerConfig } from './mcp-config';
import { clearOAuthTokens, performOAuthFlow } from './mcp-oauth';
import type { McpToolDefinition } from '@sora/shared';

type ToolEntry = {
  client: MCPClient;
  originalName: string;
};

class McpManager {
  private clients = new Map<string, MCPClient>();
  private toolEntries = new Map<string, ToolEntry>();
  private toolDefinitions: Record<string, McpToolDefinition> = {};
  private connectedServers: string[] = [];
  private serverErrors = new Map<string, string>();
  private reconnecting = new Set<string>();
  private initPromise: Promise<void> | null = null;
  private ready = false;

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    const config = loadMcpConfig();
    const entries = Object.entries(config.mcpServers).filter(([, c]) => !c.disabled);
    if (entries.length > 0) {
      await Promise.allSettled(
        entries.map(([name, serverConfig]) => this._connectServer(name, serverConfig)),
      );
    }
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  isReconnecting(name: string): boolean {
    return this.reconnecting.has(name);
  }

  private async _connectServer(name: string, config: McpServerConfig): Promise<void> {
    try {
      let transport;

      if (isHttpConfig(config)) {
        if (config.oauth) {
          const authProvider = await performOAuthFlow(name, config.url, config.oauth);
          transport = {
            type: (config.type ?? 'http') as 'http' | 'sse',
            url: config.url,
            headers: config.headers,
            authProvider,
          };
        } else {
          transport = {
            type: (config.type ?? 'http') as 'http' | 'sse',
            url: config.url,
            headers: config.headers,
          };
        }
      } else {
        transport = new StdioMCPTransport({
          command: config.command,
          args: config.args,
          env: config.env,
        });
      }

      const client = await createMCPClient({ transport, clientName: 'sora-cli' });
      this.clients.set(name, client);
      this.connectedServers.push(name);

      const { tools } = await client.listTools();
      for (const toolDef of tools) {
        const qualifiedName = `${name}__${toolDef.name}`;
        this.toolEntries.set(qualifiedName, { client, originalName: toolDef.name });
        this.toolDefinitions[qualifiedName] = {
          description: toolDef.description,
          inputSchema: toolDef.inputSchema,
        };
      }
    } catch (err) {
      this.serverErrors.set(name, err instanceof Error ? err.message : String(err));
    }
  }

  private _disconnectServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    this.clients.delete(name);
    this.connectedServers = this.connectedServers.filter((n) => n !== name);
    this.serverErrors.delete(name);
    for (const key of Object.keys(this.toolDefinitions)) {
      if (key.startsWith(`${name}__`)) {
        delete this.toolDefinitions[key];
        this.toolEntries.delete(key);
      }
    }
    return client ? client.close().catch(() => {}) : Promise.resolve();
  }

  async reconnectServer(name: string, clearAuth = false): Promise<void> {
    if (this.reconnecting.has(name)) return;
    this.reconnecting.add(name);
    try {
      await this._disconnectServer(name);
      const config = loadMcpConfig();
      const serverConfig = config.mcpServers[name];
      if (!serverConfig || serverConfig.disabled) return;
      if (clearAuth && isHttpConfig(serverConfig) && serverConfig.oauth) {
        clearOAuthTokens(name);
      }
      await this._connectServer(name, serverConfig);
    } finally {
      this.reconnecting.delete(name);
    }
  }

  toggleServerDisabled(name: string): void {
    const config = loadMcpConfig();
    const server = config.mcpServers[name];
    if (!server) return;
    const nowDisabled = !server.disabled;
    setServerDisabled(name, nowDisabled);
    if (nowDisabled) {
      void this._disconnectServer(name);
    } else {
      void this.reconnectServer(name);
    }
  }

  getToolDefinitions(): Record<string, McpToolDefinition> {
    return this.toolDefinitions;
  }

  isMcpTool(qualifiedName: string): boolean {
    return this.toolEntries.has(qualifiedName);
  }

  getConnectedServers(): string[] {
    return this.connectedServers;
  }

  getServerErrors(): ReadonlyMap<string, string> {
    return this.serverErrors;
  }

  async executeTool(qualifiedName: string, input: unknown): Promise<unknown> {
    const entry = this.toolEntries.get(qualifiedName);
    if (!entry) throw new Error(`Unknown MCP tool: ${qualifiedName}`);

    return entry.client.callTool({
      name: entry.originalName,
      arguments: input as Record<string, unknown>,
    });
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.clients.values()].map((c) => c.close()));
  }
}

export const mcpManager = new McpManager();
