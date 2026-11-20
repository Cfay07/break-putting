import { useEffect, useState } from 'react';

export function useRoute(): string {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onHash);
    window.addEventListener(ROUTED, onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener(ROUTED, onHash);
    };
  }, []);
  return route;
}

/**
 * Said the moment the app moves, so the new page renders in the same frame as the tap. Waiting
 * for the browser's own hashchange left one frame of the old page. The scroll to the top happens
 * once the new page is drawn (App's layout effect), not here, where it jolted the old one first.
 */
const ROUTED = 'break:route';
const routed = () => window.dispatchEvent(new Event(ROUTED));

export function go(path: string): void {
  window.location.hash = path;
  routed();
}

/**
 * Go somewhere without leaving the current page in history. For anything that just deleted the
 * page you are on: a pushed route left it one swipe back, showing "That round is gone."
 */
export function replaceRoute(path: string): void {
  window.location.replace(`#${path}`);
  routed();
}

const TAB_ROOTS = new Set(['/', '/stats', '/stats/practice', '/practice', '/settings', '/team', '/track']);
const FORM = /^\/practice\/(edit|session-edit)\//;

/**
 * Where you have been, for the back link. Forms stay out: saving one lands on the page it edited,
 * and a back link into the form you just left would loop. Coming back to a page drops everything
 * after it, and a tab starts over.
 */
export function nextTrail(trail: string[], route: string): string[] {
  if (FORM.test(route)) return trail;
  if (TAB_ROOTS.has(route)) return [route];
  const seen = trail.lastIndexOf(route);
  return seen >= 0 ? trail.slice(0, seen + 1) : [...trail, route];
}

export function backLabel(route: string): string {
  if (route === '/') return 'Rounds';
  if (route.startsWith('/stats')) return 'Stats';
  if (route === '/practice') return 'Practice';
  if (route === '/practice/sessions') return 'Sessions';
  if (route === '/practice/drills') return 'Every drill';
  if (route === '/practice/why') return 'Why this';
  if (route === '/practice/tempo') return 'Metronome';
  if (route === '/practice/hands') return 'Hands';
  if (route === '/practice/distances') return 'Distances';
  if (route === '/practice/log') return 'Every practice';
  if (route.startsWith('/practice/session/')) return 'Session';
  if (route.startsWith('/practice/drill/')) return 'Drill';
  if (route.startsWith('/round/')) return 'Round';
  if (route === '/settings') return 'Settings';
  if (route === '/moments' || route === '/history') return 'History';
  if (route === '/team') return 'Team';
  return 'Back';
}

let trail: string[] = [];
if (typeof window !== 'undefined') {
  const note = () => {
    trail = nextTrail(trail, window.location.hash.slice(1) || '/');
  };
  note();
  // Added on import, so it runs before any page rendering off the same move. go() renders on its
  // own event before the hashchange, so the trail listens to both; a second note of the same route
  // changes nothing.
  window.addEventListener(ROUTED, note);
  window.addEventListener('hashchange', note);
}

/** The page before this one, or nothing when this is the first page since the app opened. */
export function previousRoute(): string | null {
  return trail.length > 1 ? trail[trail.length - 2] : null;
}

/**
 * The last page before this one that is not skipped. Round to round to round through the rankings
 * should go back to where the first round was opened from, not to the round before it.
 */
export function previousRouteBut(skip: (route: string) => boolean): string | null {
  for (let i = trail.length - 2; i >= 0; i--) if (!skip(trail[i])) return trail[i];
  return null;
}
