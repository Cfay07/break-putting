export function Seg<T extends string>({
  options,
  value,
  onPick,
  quiet,
  labels,
}: {
  options: readonly T[];
  value: T | undefined;
  onPick: (v: T | undefined) => void;
  quiet?: boolean;
  labels?: Record<string, string>;
}) {
  return (
    <div className={quiet ? 'seg seg-quiet' : 'seg'}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onPick(value === o ? undefined : o)}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}
