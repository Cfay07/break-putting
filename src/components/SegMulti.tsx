export function SegMulti<T extends string>({
  options,
  values,
  onToggle,
  quiet,
  labels,
}: {
  options: readonly T[];
  values: T[];
  onToggle: (v: T) => void;
  quiet?: boolean;
  labels?: Record<string, string>;
}) {
  return (
    <div className={quiet ? 'seg seg-quiet' : 'seg'}>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={values.includes(o)} onClick={() => onToggle(o)}>
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}
