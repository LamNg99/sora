import open from 'open';
import { saveAuth } from './auth';

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

type OAuthState = {
  nonce: string;
  port: number;
};

function toBase64Url(input: Uint8Array | string) {
  return Buffer.from(input).toString('base64url');
}

async function createPkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}

function encodeState(state: OAuthState) {
  return toBase64Url(JSON.stringify(state));
}

function decodeState(state: string) {
  const [encoded] = state.split('.');
  if (!encoded) throw new Error('Invalid state');

  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as OAuthState;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function performLogin() {
  const clerkFrontendApi = process.env.CLERK_FRONTEND_API;
  const clerkClientId = process.env.CLERK_OAUTH_CLIENT_ID;
  const apiUrl = process.env.API_URL || 'http://localhost:3000';

  if (!clerkFrontendApi) throw new Error('CLERK_FRONTEND_API environment variable is not set');
  if (!clerkClientId) throw new Error('CLERK_CLIENT_ID environment variable is not set');

  const nonce = crypto.randomUUID();
  const codeVerifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const codeChallenge = await createPkceChallenge(codeVerifier);

  let settled = false;

  return new Promise<{ token: string }>((resolve, reject) => {
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);

        if (url.pathname !== '/callback') {
          return new Response('Not found', { status: 404 });
        }

        const error = url.searchParams.get('error');

        if (error) {
          const msg = url.searchParams.get('error_description') ?? error;
          settled = true;
          reject(new Error(`Login failed: ${msg}`));
          setTimeout(() => server.stop(), 500);
          return new Response(`Authentication failed: ${msg}`, { status: 400 });
        }

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (!code || !state) {
          settled = true;
          reject(new Error('Missing code or state'));
          setTimeout(() => server.stop(), 500);
          return new Response('Bad request', { status: 400 });
        }

        // Verify nonce from state
        try {
          const payload = decodeState(state);

          if (payload.nonce !== nonce) throw new Error('State mismatch');
        } catch (err) {
          settled = true;
          reject(err);
          setTimeout(() => server.stop(), 500);
          return new Response('Invalid state', { status: 400 });
        }

        try {
          // Exchange the authorization code for tokens
          const redirectUri = `${apiUrl}/auth/callback`;

          const tokenResponse = await fetch(`${clerkFrontendApi}/oauth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: clerkClientId,
              code: code,
              code_verifier: codeVerifier,
              redirect_uri: redirectUri,
            }),
          });

          if (!tokenResponse.ok) {
            const details = await tokenResponse.text();
            throw new Error(details || 'Failed to exchange authorization code for tokens');
          }

          const tokenData = (await tokenResponse.json()) as { access_token: string };
          settled = true;
          saveAuth({ token: tokenData.access_token });
          resolve({ token: tokenData.access_token });
          setTimeout(() => server.stop(), 500);
          return new Response('Authenticated! You can close this tab.');
        } catch (err) {
          settled = true;
          reject(err);
          const message = getErrorMessage(err);
          setTimeout(() => server.stop(), 500);
          return new Response(`Authentication failed: ${message}`, { status: 400 });
        }
      },
    });

    // Build state with nonce and port
    const port = server.port;
    if (typeof port !== 'number') {
      server.stop();
      reject(new Error('Failed to start callback server'));
      return;
    }

    const state = encodeState({ nonce, port });

    const redirectUri = `${apiUrl}/auth/callback`;
    const authorizeUrl = new URL(`${clerkFrontendApi}/oauth/authorize`);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', clerkClientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('scope', 'openid profile email');
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('prompt', 'login');
    authorizeUrl.searchParams.set('code_challenge', codeChallenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');

    open(authorizeUrl.toString());

    setTimeout(() => {
      if (!settled) {
        settled = true;
        server.stop();
        reject(new Error('Login timed out'));
      }
    }, LOGIN_TIMEOUT_MS);
  });
}
