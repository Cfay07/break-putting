import { useEffect, useState } from 'react';

export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = 'btn btn-danger',
  style,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      className={armed ? `${className} armed` : className}
      style={style}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
