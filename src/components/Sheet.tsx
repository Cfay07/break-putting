import { useEffect, type ReactNode } from 'react';

// Sheets can stack (a course sheet over the round sheet), so the page stays pinned until the last
// one closes. iOS Safari ignores overflow: hidden on body, hence pinning it with position: fixed.
let openSheets = 0;
let savedScroll = 0;

function lockPage() {
  if (openSheets++ > 0) return;
  savedScroll = window.scrollY;
  const b = document.body.style;
  b.position = 'fixed';
  b.top = `-${savedScroll}px`;
  b.left = '0';
  b.right = '0';
  b.overflow = 'hidden';
}

function unlockPage() {
  if (--openSheets > 0) return;
  const b = document.body.style;
  b.position = b.top = b.left = b.right = b.overflow = '';
  window.scrollTo(0, savedScroll);
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    lockPage();
    return unlockPage;
  }, []);

  return (
    <div className="sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="topbar" style={{ borderBottomWidth: 1, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="linkish tiny" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
