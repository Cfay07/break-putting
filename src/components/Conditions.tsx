const BUMPY = [
  { n: 1, label: 'Smooth' },
  { n: 2, label: 'Average' },
  { n: 3, label: 'Bumpy' },
];

/**
 * What the greens were like beyond how fast they rolled. Recorded and never scored against: a
 * guessed penalty would bake the guess into strokes gained where nobody could ever check it.
 */
export function Conditions({
  aerated,
  bumpy,
  onChange,
}: {
  aerated: boolean | undefined;
  bumpy: number | undefined;
  onChange: (patch: { aerated?: boolean; bumpy?: number }) => void;
}) {
  return (
    <>
      <div className="field-label">Greens, beyond speed</div>
      <div className="chips">
        <button
          type="button"
          className={aerated ? 'chip chip-sel' : 'chip'}
          aria-pressed={!!aerated}
          onClick={() => onChange({ aerated: !aerated })}
        >
          Aerated
        </button>
        {BUMPY.map((b) => (
          <button
            key={b.n}
            type="button"
            className={bumpy === b.n ? 'chip chip-sel' : 'chip'}
            aria-pressed={bumpy === b.n}
            onClick={() => onChange({ bumpy: bumpy === b.n ? undefined : b.n })}
          >
            {b.label}
          </button>
        ))}
      </div>
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        Kept with the round and never scored against it. Punched greens especially: they are the
        biggest thing that happens to a putting surface and the easiest to forget by next week.
      </p>
    </>
  );
}
