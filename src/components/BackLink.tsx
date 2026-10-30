import { backLabel, previousRoute } from '../lib/router';

/** Back to the page you came from. `to` is for when there is none, like after a reload. */
export function BackLink({ to = '/practice' }: { to?: string }) {
  const target = previousRoute() ?? to;
  return (
    <a href={`#${target}`} className="back-link">
      ‹ {backLabel(target)}
    </a>
  );
}
