import { currentSession } from './cloud';

/**
 * The last thing each team screen loaded, kept for this visit to the app. Coming back to a tab
 * shows it straight away and the fresh copy replaces it when it lands, instead of a blank
 * "Loading" every time. Keyed by account, so a different sign-in never sees someone else's.
 */
const last = new Map<string, unknown>();
const keyOf = (name: string) => `${currentSession()?.userId ?? 'none'}:${name}`;

export const lastLoaded = <T>(name: string): T | undefined => last.get(keyOf(name)) as T | undefined;

export function remember<T>(name: string, value: T): T {
  last.set(keyOf(name), value);
  return value;
}
