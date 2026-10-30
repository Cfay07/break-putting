import { useEffect, useState } from 'react';

export function useRoute(): string {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

export function go(path: string): void {
  window.location.hash = path;
  window.scrollTo(0, 0);
}

/**
 * Go somewhere without leaving the current page in history. For anything that just deleted the
 * page you are on: a pushed route left it one swipe back, showing "That round is gone."
 */
export function replaceRoute(path: string): void {
  window.location.replace(`#${path}`);
  window.scrollTo(0, 0);
}
