import { FACTORS, type Putt } from '../lib/types';

type Fault = (typeof FACTORS)[number];

const ROWS: { k: string; tags: [Fault, string][] }[] = [
  {
    k: 'Line',
    tags: [
      ['push', 'Pushed'],
      ['pull', 'Pulled'],
    ],
  },
  {
    k: 'Pace',
    tags: [
      ['decel', 'Decel'],
      ['accel', 'Accel'],
    ],
  },
];

/**
 * How the putt was hit, one row per part of it: where on the face, the start line, the pace of
 * the stroke, and whether you were committed. Clean says outright that nothing was wrong, so an
 * untagged putt still means nobody looked rather than a perfect stroke.
 */
export function StrokeTags({
  putt,
  onPatch,
  selClass = 'chip-on',
}: {
  putt: Partial<Putt>;
  onPatch: (patch: Partial<Putt>) => void;
  selClass?: string;
}) {
  const offCentre = putt.strike === 'toe' || putt.strike === 'heel';
  const clean = !!putt.executionAssessed && !FACTORS.some((f) => putt[f]) && !offCentre;
  const chip = (on: boolean) => (on ? `chip ${selClass}` : 'chip');

  return (
    <div className="stroke-tags">
      <div className="field-label stroke-head">
        Stroke
        <button
          type="button"
          className={chip(clean)}
          aria-pressed={clean}
          onClick={() =>
            onPatch(
              clean
                ? { executionAssessed: undefined }
                : {
                    ...Object.fromEntries(FACTORS.map((f) => [f, false])),
                    ...(offCentre ? { strike: undefined } : {}),
                    executionAssessed: true,
                  },
            )
          }
        >
          Clean
        </button>
      </div>
      <div className="stroke-row">
        <span className="k">Face</span>
        <div className="chips chips-sm">
          {(['toe', 'centre', 'heel'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={chip(putt.strike === s)}
              aria-pressed={putt.strike === s}
              onClick={() => onPatch({ strike: putt.strike === s ? undefined : s, executionAssessed: true })}
            >
              {s === 'centre' ? 'Middle' : s === 'toe' ? 'Toe' : 'Heel'}
            </button>
          ))}
        </div>
      </div>
      {ROWS.map((row) => (
        <div className="stroke-row" key={row.k}>
          <span className="k">{row.k}</span>
          <div className="chips chips-sm">
            {row.tags.map(([f, label]) => (
              <button
                key={f}
                type="button"
                className={chip(!!putt[f])}
                aria-pressed={!!putt[f]}
                // A stroke cannot push and pull, or quit and jab, at once: each row is one answer.
                onClick={() =>
                  onPatch({
                    ...Object.fromEntries(row.tags.map(([g]) => [g, g === f ? !putt[f] : false])),
                    executionAssessed: true,
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="stroke-row">
        <span className="k">Mind</span>
        <div className="chips chips-sm">
          {/* One chip, three states: not said, committed, not committed. Committed is the common
              answer so it is one tap; not committed is two. */}
          <button
            type="button"
            className={putt.uncommitted === undefined ? 'chip' : putt.uncommitted ? 'chip chip-no' : `chip ${selClass}`}
            aria-pressed={putt.uncommitted !== undefined}
            onClick={() =>
              onPatch(
                putt.uncommitted === undefined
                  ? { uncommitted: false, executionAssessed: true }
                  : putt.uncommitted === false
                    ? { uncommitted: true, executionAssessed: true }
                    : { uncommitted: undefined },
              )
            }
          >
            {putt.uncommitted === undefined ? 'Committed?' : putt.uncommitted ? 'Not committed' : 'Committed'}
          </button>
        </div>
      </div>
    </div>
  );
}
