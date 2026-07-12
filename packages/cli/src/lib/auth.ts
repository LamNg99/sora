import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

type AuthData = {
  token: string;
};

const AUTH_DIR = join(homedir(), '.sora');
const AUTH_FILE = join(AUTH_DIR, 'auth.json');

export function getAuth(): AuthData | null {
  try {
    const data = readFileSync(AUTH_FILE, 'utf-8');
    const parsed = JSON.parse(data) as Partial<AuthData>;
    return typeof parsed.token === 'string' ? { token: parsed.token } : null;
  } catch {
    return null;
  }
}

export function saveAuth(data: AuthData): void {
  if (!existsSync(AUTH_DIR)) {
    // Owner-only permissions (rwx------)
    mkdirSync(AUTH_DIR, { mode: 0o700 });
  }
  writeFileSync(AUTH_FILE, JSON.stringify(data), { mode: 0o600 });
}

export function clearAuth(): void {
  try {
    unlinkSync(AUTH_FILE);
  } catch {
    // File does not exist or cannot be deleted, ignore the error
  }
}
