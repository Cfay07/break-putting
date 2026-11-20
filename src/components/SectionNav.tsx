import { useLayoutEffect, useState } from 'react';

/**
 * A jump list for a long page.
 *
 * The stats page is two dozen sections and growing, and the usual fix is to collapse things.
 * A collapsed section is one nobody opens, so nothing here hides: this reads the headings that
 * are already on the page and gives them a row of chips, so a long page becomes navigable
 * instead of becoming a shorter page with the good parts behind a tap.
 */
export function SectionNav({ scope }: { scope: string }) {
  const [names, setNames] = useState<string[]>([]);

  // Before paint, so the page never lands without the row and then jumps down when it arrives.
  // Every render, because a filter can hide or bring back a section. setNames keeps the old list
  // when nothing changed, so this settles after one pass.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const root = document.querySelector(scope);
    if (!root) return;
    const heads = [...root.querySelectorAll('h2')];
    heads.forEach((h, i) => {
      h.id = `sec-${i}`;
    });
    const next = heads.map((h) => h.textContent ?? '');
    setNames((prev) => (prev.length === next.length && prev.every((n, i) => n === next[i]) ? prev : next));
  });

  if (names.length < 6) return null;

  return (
    <nav className="secnav" aria-label="Jump to a section">
      {names.map((n, i) => (
        <button
          key={i}
          type="button"
          className="secnav-chip"
          onClick={() => {
            document.getElementById(`sec-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          {n}
        </button>
      ))}
    </nav>
  );
}
