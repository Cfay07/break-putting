/**
 * Supabase auth and storage, spoken to directly over REST. No client library: the app only
 * needs sign in, sign up, a token refresh, and two table calls, and a service worker app that
 * has to boot with no signal is better off without the extra weight.
 */

const URL = 'https://fazvjcctwdwrrjjguowl.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhenZqY2N0d2R3cnJqamd1b3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3ODA0NDQsImV4cCI6MjEwNTM1NjQ0NH0.QNc51NnUwGurrFzPes_tShUjZnK67LkwfDj984_hnBM';

const SESSION_KEY = 'break.session';

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
  userId: string;
}

export function currentSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function keepSession(s: Session | null): void {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // a session that cannot be stored still works for this launch
  }
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email: string };
  error_description?: string;
  msg?: string;
  message?: string;
}

function sessionFrom(data: TokenResponse): Session {
  if (!data.access_token || !data.user) {
    throw new Error(data.error_description || data.msg || data.message || 'Sign in failed.');
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? '',
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    email: data.user.email,
    userId: data.user.id,
  };
}

async function auth(path: string, body: unknown): Promise<TokenResponse> {
  const res = await fetch(`${URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || data.message || `Sign in failed (${res.status}).`);
  }
  return data;
}

export async function signUp(email: string, password: string): Promise<Session> {
  const s = sessionFrom(await auth('signup', { email, password }));
  keepSession(s);
  return s;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const s = sessionFrom(await auth('token?grant_type=password', { email, password }));
  keepSession(s);
  return s;
}

export function signOut(): void {
  keepSession(null);
}

async function refresh(session: Session): Promise<Session> {
  const s = sessionFrom(
    await auth('token?grant_type=refresh_token', { refresh_token: session.refreshToken }),
  );
  keepSession(s);
  return s;
}

/** A table call that renews an expired token once before giving up. */
export async function table(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> {
  let session = currentSession();
  if (!session) throw new Error('Not signed in.');
  if (session.expiresAt < Date.now() + 60_000 && session.refreshToken) {
    session = await refresh(session);
  }

  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && retry && session.refreshToken) {
    await refresh(session);
    return table(path, init, false);
  }
  return res;
}

export function online(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}
