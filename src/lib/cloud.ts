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
  /** What teams show you as. Stored on the auth user so it follows the account, not the phone. */
  name?: string;
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
  user?: { id: string; email: string; user_metadata?: { name?: string } };
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
    name: data.user.user_metadata?.name || undefined,
  };
}

/** "conor.fayard" is not a name. Make the email local-part presentable as a last resort. */
export function nameFromEmail(email: string): string {
  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** The name this account shows up under. What they set wins, the email is the fallback. */
export function accountName(): string {
  const s = currentSession();
  if (!s) return '';
  return s.name?.trim() || nameFromEmail(s.email);
}

/** Empty until they actually set one, which is how the UI knows the fallback is still showing. */
export function storedName(): string {
  return currentSession()?.name?.trim() ?? '';
}

export async function saveAccountName(name: string): Promise<void> {
  let session = currentSession();
  if (!session) throw new Error('Not signed in.');
  if (session.expiresAt < Date.now() + 60_000 && session.refreshToken) {
    session = await refresh(session);
  }
  const res = await fetch(`${URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: { name: name.trim() } }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as TokenResponse | null;
    throw new Error(data?.msg || data?.message || `Could not save your name (${res.status}).`);
  }
  keepSession({ ...session, name: name.trim() });
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

/**
 * Supabase sends the recovery link back to this app with its token in the URL hash, which is
 * also where the router keeps the route. Captured once at module load and cleared immediately,
 * so the router never sees it and a refresh cannot replay a stale token.
 */
function grabRecoveryToken(): string | null {
  const raw = window.location.hash.slice(1);
  if (!raw.includes('access_token=')) return null;
  const params = new URLSearchParams(raw);
  const token = params.get('access_token');
  const kind = params.get('type');
  history.replaceState(null, '', window.location.pathname + window.location.search + '#/settings');
  return kind === 'recovery' && token ? token : null;
}

const recoveryToken = typeof window === 'undefined' ? null : grabRecoveryToken();

export function pendingRecovery(): string | null {
  return recoveryToken;
}

/** Ask Supabase to email a reset link back to this app. */
export async function requestReset(email: string): Promise<void> {
  const redirect = `${window.location.origin}${window.location.pathname}`;
  const res = await fetch(
    `${URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`,
    {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as TokenResponse | null;
    throw new Error(data?.msg || data?.message || `Could not send the email (${res.status}).`);
  }
}

/** Set a new password using the token from the emailed link. */
export async function setNewPassword(token: string, password: string): Promise<Session> {
  const res = await fetch(`${URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
  const data = (await res.json()) as TokenResponse & { id?: string; email?: string };
  if (!res.ok) {
    throw new Error(data.msg || data.message || `Could not set the password (${res.status}).`);
  }
  // The recovery token is already a session; keep it so the reset lands you signed in.
  const s: Session = {
    accessToken: token,
    refreshToken: '',
    expiresAt: Date.now() + 3600 * 1000,
    email: data.email ?? '',
    userId: data.id ?? '',
  };
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
