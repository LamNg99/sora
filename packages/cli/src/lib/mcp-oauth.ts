import {
  auth,
  type OAuthClientInformation,
  type OAuthClientMetadata,
  type OAuthClientProvider,
  type OAuthTokens,
} from '@ai-sdk/mcp';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { createServer } from 'node:http';
import { homedir } from 'os';
import { join } from 'path';
import open from 'open';
import type { OAuthMcpConfig } from './mcp-config';

const TOKENS_DIR = join(homedir(), '.sora', 'mcp-tokens');
const CALLBACK_PORT = 3847;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

type StoredOAuthData = {
  tokens?: OAuthTokens;
  clientInfo?: OAuthClientInformation;
  codeVerifier?: string;
  state?: string;
};

function tokenPath(serverName: string) {
  return join(TOKENS_DIR, `${serverName}.json`);
}

function readStored(serverName: string): StoredOAuthData {
  try {
    return JSON.parse(readFileSync(tokenPath(serverName), 'utf-8')) as StoredOAuthData;
  } catch {
    return {};
  }
}

function writeStored(serverName: string, data: StoredOAuthData): void {
  if (!existsSync(TOKENS_DIR)) mkdirSync(TOKENS_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(tokenPath(serverName), JSON.stringify(data, null, 2), { mode: 0o600 });
}

function waitForOAuthCallback(): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`);
      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state') ?? '';

      if (!code) {
        const error = url.searchParams.get('error') ?? 'access_denied';
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h2>Authorization failed</h2><p>${error}</p><p>You can close this tab.</p></body></html>`);
        server.close();
        reject(new Error(`OAuth authorization failed: ${error}`));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Authorization successful</h2><p>You can close this tab and return to Sora.</p></body></html>');
      server.close();
      resolve({ code, state });
    });

    server.on('error', reject);

    server.listen(CALLBACK_PORT, 'localhost');

    setTimeout(() => {
      server.close();
      reject(new Error('OAuth timed out: no browser callback received within 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

export class CliOAuthProvider implements OAuthClientProvider {
  private readonly serverName: string;
  private readonly config: OAuthMcpConfig;

  constructor(serverName: string, config: OAuthMcpConfig) {
    this.serverName = serverName;
    this.config = config;
  }

  get redirectUrl(): string {
    return REDIRECT_URI;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [REDIRECT_URI],
      client_name: `Sora CLI — ${this.serverName}`,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      ...(this.config.scope ? { scope: this.config.scope } : {}),
    };
  }

  tokens(): OAuthTokens | undefined {
    return readStored(this.serverName).tokens;
  }

  saveTokens(tokens: OAuthTokens): void {
    writeStored(this.serverName, { ...readStored(this.serverName), tokens });
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    void open(authorizationUrl.toString());
  }

  saveCodeVerifier(codeVerifier: string): void {
    writeStored(this.serverName, { ...readStored(this.serverName), codeVerifier });
  }

  codeVerifier(): string {
    const stored = readStored(this.serverName).codeVerifier;
    if (!stored) throw new Error(`No PKCE code verifier stored for MCP server "${this.serverName}"`);
    return stored;
  }

  clientInformation(): OAuthClientInformation | undefined {
    const stored = readStored(this.serverName).clientInfo;
    if (stored) return stored;
    return {
      client_id: this.config.clientId,
      ...(this.config.clientSecret ? { client_secret: this.config.clientSecret } : {}),
    };
  }

  saveClientInformation(clientInfo: OAuthClientInformation): void {
    writeStored(this.serverName, { ...readStored(this.serverName), clientInfo });
  }

  state(): string {
    return readStored(this.serverName).state ?? '';
  }

  saveState(state: string): void {
    writeStored(this.serverName, { ...readStored(this.serverName), state });
  }

  storedState(): string | undefined {
    return readStored(this.serverName).state;
  }

  invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier'): void {
    const data = readStored(this.serverName);
    if (scope === 'all') {
      writeStored(this.serverName, {});
    } else if (scope === 'tokens') {
      const { tokens: _, ...rest } = data;
      writeStored(this.serverName, rest);
    } else if (scope === 'client') {
      const { clientInfo: _, ...rest } = data;
      writeStored(this.serverName, rest);
    } else if (scope === 'verifier') {
      const { codeVerifier: _, ...rest } = data;
      writeStored(this.serverName, rest);
    }
  }
}

export function clearOAuthTokens(serverName: string): void {
  writeStored(serverName, {});
}

export async function performOAuthFlow(
  serverName: string,
  serverUrl: string,
  oauthConfig: OAuthMcpConfig,
): Promise<CliOAuthProvider> {
  const provider = new CliOAuthProvider(serverName, oauthConfig);

  const result = await auth(provider, { serverUrl });
  if (result === 'AUTHORIZED') return provider;

  // Browser was opened by redirectToAuthorization — wait for the local callback
  const { code, state } = await waitForOAuthCallback();
  await auth(provider, { serverUrl, authorizationCode: code, callbackState: state });

  return provider;
}
