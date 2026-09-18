import type { ReactNode } from 'react';

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
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
