import { useState, type ReactNode } from 'react';

/**
 * A short line on screen and the rest a tap away.
 *
 * The caveats are worth keeping and were never worth fifty words of permanent screen. Depth moves
 * behind the question mark rather than being deleted, so a number still cannot be read wrongly by
 * anyone who wants to know, and is not buried for anyone who does not.
 */
export function Why({ children, lead }: { lead: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className="note">
        {lead}
        <button type="button" className="why" aria-expanded={open} onClick={() => setOpen(!open)}>
          ?
        </button>
      </p>
      {open && <p className="why-note">{children}</p>}
    </>
  );
}
