import { useEffect, useState } from 'react';
import { TextAttributes } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useKeyboardLayer } from '../providers/keyboard-layer';
import { mcpManager } from '../lib/mcp-manager';
import { loadMcpConfig, isHttpConfig } from '../lib/mcp-config';

type ServerStatus =
  | { kind: 'connected'; toolCount: number }
  | { kind: 'error'; message: string }
  | { kind: 'disabled' }
  | { kind: 'reconnecting' }
  | { kind: 'idle' };

type ServerEntry = {
  name: string;
  hasOAuth: boolean;
  status: ServerStatus;
};

function buildEntries(reconnecting: Set<string>, _tick: number): ServerEntry[] {
  const config = loadMcpConfig();
  const toolDefs = mcpManager.getToolDefinitions();
  const errors = mcpManager.getServerErrors();
  const connected = new Set(mcpManager.getConnectedServers());

  return Object.entries(config.mcpServers).map(([name, serverConfig]) => {
    let status: ServerStatus;
    if (reconnecting.has(name) || mcpManager.isReconnecting(name)) {
      status = { kind: 'reconnecting' };
    } else if (serverConfig.disabled) {
      status = { kind: 'disabled' };
    } else if (connected.has(name)) {
      const toolCount = Object.keys(toolDefs).filter((k) => k.startsWith(`${name}__`)).length;
      status = { kind: 'connected', toolCount };
    } else if (errors.has(name)) {
      status = { kind: 'error', message: errors.get(name)! };
    } else {
      status = { kind: 'idle' };
    }

    return {
      name,
      hasOAuth: isHttpConfig(serverConfig) && !!serverConfig.oauth,
      status,
    };
  });
}

export function McpDialogContent() {
  const [ready, setReady] = useState(() => mcpManager.isReady());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [reconnecting, setReconnecting] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const { isTopLayer } = useKeyboardLayer();

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    mcpManager
      .initialize()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const config = loadMcpConfig();
  const serverNames = Object.keys(config.mcpServers);
  const entries = buildEntries(reconnecting, tick);
  const selectedEntry = entries[selectedIndex];

  useKeyboard((key) => {
    if (!isTopLayer('dialog')) return;
    if (serverNames.length === 0) return;

    if (key.name === 'up') {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (key.name === 'down') {
      setSelectedIndex((i) => Math.min(i + 1, serverNames.length - 1));
    } else if (key.name === 'd') {
      const name = serverNames[selectedIndex];
      if (!name) return;
      const entry = entries.find((e) => e.name === name);
      if (!entry) return;
      const isEnabling = entry.status.kind === 'disabled';
      if (isEnabling) {
        setReconnecting((prev) => new Set(prev).add(name));
      }
      void mcpManager.toggleServerDisabled(name).finally(() => {
        if (isEnabling) {
          setReconnecting((prev) => {
            const next = new Set(prev);
            next.delete(name);
            return next;
          });
        }
        setTick((t) => t + 1);
      });
      if (!isEnabling) setTick((t) => t + 1);
    } else if (key.name === 'r') {
      const name = serverNames[selectedIndex];
      if (!name) return;
      const entry = entries.find((e) => e.name === name);
      if (!entry || entry.status.kind === 'disabled' || entry.status.kind === 'reconnecting') return;
      const clearAuth = entry.hasOAuth;
      setReconnecting((prev) => new Set(prev).add(name));
      void mcpManager.reconnectServer(name, clearAuth).finally(() => {
        setReconnecting((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
        setTick((t) => t + 1);
      });
    }
  });

  if (serverNames.length === 0) {
    return (
      <box flexDirection="column" gap={1} paddingX={1}>
        <text attributes={TextAttributes.DIM}>No MCP servers configured.</text>
        <text attributes={TextAttributes.DIM}>Add servers to ~/.sora/mcp.json to get started.</text>
      </box>
    );
  }

  if (!ready) {
    return (
      <box paddingX={1}>
        <text attributes={TextAttributes.DIM}>Connecting to MCP servers…</text>
      </box>
    );
  }

  const canAct =
    selectedEntry &&
    selectedEntry.status.kind !== 'reconnecting';

  return (
    <box flexDirection="column" gap={1}>
      <scrollbox height={Math.min(entries.length, 10)}>
        <box flexDirection="column">
          {entries.map((entry, i) => {
            const isSelected = i === selectedIndex;
            const bg = isSelected ? 'white' : undefined;
            const fgDefault = isSelected ? 'black' : 'white';

            let statusIcon: string;
            let statusFg: string;
            let statusText: string;

            if (entry.status.kind === 'connected') {
              statusIcon = '●';
              statusFg = isSelected ? 'black' : 'green';
              statusText = `${entry.status.toolCount} ${entry.status.toolCount === 1 ? 'tool' : 'tools'}`;
            } else if (entry.status.kind === 'error') {
              statusIcon = '✕';
              statusFg = isSelected ? 'black' : 'red';
              statusText = entry.status.message;
            } else if (entry.status.kind === 'disabled') {
              statusIcon = '○';
              statusFg = isSelected ? 'black' : 'gray';
              statusText = 'disabled';
            } else if (entry.status.kind === 'reconnecting') {
              statusIcon = '◌';
              statusFg = isSelected ? 'black' : 'yellow';
              statusText = entry.hasOAuth ? 'authenticating…' : 'connecting…';
            } else {
              statusIcon = '○';
              statusFg = isSelected ? 'black' : 'gray';
              statusText = 'not connected';
            }

            return (
              <box
                key={entry.name}
                flexDirection="row"
                paddingX={1}
                gap={2}
                height={1}
                backgroundColor={bg}
              >
                <text fg={statusFg}>{statusIcon}</text>
                <box width={20} flexShrink={0}>
                  <text fg={fgDefault}>{entry.name}</text>
                </box>
                <box flexGrow={1} flexShrink={1} overflow="hidden">
                  <text
                    fg={isSelected ? 'black' : 'gray'}
                    attributes={isSelected ? undefined : TextAttributes.DIM}
                  >
                    {statusText}
                  </text>
                </box>
              </box>
            );
          })}
        </box>
      </scrollbox>

      {canAct ? (
        <box flexDirection="row" gap={3} paddingX={1}>
          <box flexDirection="row" gap={1}>
            <text fg="white" attributes={TextAttributes.BOLD}>d</text>
            <text attributes={TextAttributes.DIM}>
              {selectedEntry.status.kind === 'disabled' ? 'enable' : 'disable'}
            </text>
          </box>
          {selectedEntry.status.kind !== 'disabled' ? (
            <box flexDirection="row" gap={1}>
              <text fg="white" attributes={TextAttributes.BOLD}>r</text>
              <text attributes={TextAttributes.DIM}>
                {selectedEntry.hasOAuth ? 're-authenticate' : 'reconnect'}
              </text>
            </box>
          ) : null}
        </box>
      ) : null}
    </box>
  );
}
