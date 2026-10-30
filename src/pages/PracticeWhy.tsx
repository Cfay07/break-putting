import { BackLink } from '../components/BackLink';
import { useState } from 'react';
import { DrillLogger } from '../components/DrillLogger';
import { DrillPreview } from '../components/DrillPreview';
import { ZoneBars } from '../components/ZoneBars';
import { distanceText, drillsNear, type Fitted } from '../lib/drills';
import { COND_LABEL } from '../lib/pinpoint';
import { histories, LEAN_TEXT, type ZoneRead } from '../lib/practice';
import { setScoreShort } from '../lib/practiceView';
import { confidenceOf, signedFor } from '../lib/sample';
import { resolveDrill } from '../lib/drills';
import { usePlan, type WhyItem } from '../lib/usePlan';
import { DEFAULT_BASELINE, isLagZone, SURFACE_LABELS, type MissDir, type Surface, type Zone } from '../lib/types';

export const DIR_MEANS: Record<MissDir, string> = {
  left: 'That is start line, not the read.',
  right: 'That is start line, not the read.',
  short: 'Short never goes in.',
  long: 'Long is where the comebackers come from.',
};

function DrillRow({ d, last, onPick, fix }: { d: Fitted; last: string | null; onPick: (d: Fitted) => void; fix?: boolean }) {
  return (
    <button className={fix ? 'focus-drill fix' : 'focus-drill'} onClick={() => onPick(d)}>
      <span>
        <strong>{d.name}</strong>
        {!fix && <span className="small muted"> · {distanceText(d)}</span>}
      </span>
      <span className="small muted num">{last ?? '›'}</span>
    </button>
  );
}

function ZoneCard({
  z,
  worst,
  close,
  was,
  drills,
  surface,
  lastOf,
  onRoll,
  toWorst,
  why,
}: {
  z: ZoneRead;
  worst: boolean;
  close: ZoneRead | null;
  /** The season's biggest leak, when it is no longer the recent one. */
  was: (Pick<ZoneRead, 'label' | 'sgPerRound' | 'sample'> & { rounds: number }) | null;
  drills: Fitted[];
  surface: Surface;
  lastOf: (id: string) => string | null;
  onRoll: (d: Fitted) => void;
  /** Back to the zone worth working on, from one that is holding up. */
  toWorst?: () => void;
  why: WhyItem[];
}) {
  const thin = confidenceOf(z.sample) === 'waiting';
  const holding = !thin && z.sgPerRound >= 0;
  const readMiss = z.lean && (z.lean.lean === 'high' || z.lean.lean === 'low');
  return (
    <div className={`card focus-card${z.sgPerRound < 0 && !thin ? ' lose' : holding ? ' hold' : ''}`}>
      <div className="focus-head">
        <h3>{z.label}</h3>
        {worst && <span className="focus-tag">Biggest leak</span>}
        {holding && <span className="focus-tag good">Holding up</span>}
      </div>
      {thin ? (
        <p className="small muted" style={{ margin: '4px 0 0' }}>
          {z.attempts} putts from here so far, too few to say what it costs.
        </p>
      ) : (
        <>
          <div className="focus-num num">{signedFor(z.sgPerRound, z.sample)}</div>
          <p className="small muted focus-sub">
            strokes a round against scratch{confidenceOf(z.sample) === 'thin' && ' · thin sample'}
          </p>
          <ZoneStats z={z} />
          {close && (
            <p className="small muted focus-sub">
              {close.label} is close behind at {signedFor(close.sgPerRound, close.sample)}, near enough to be a tie.
            </p>
          )}
          {was && (
            <p className="small muted focus-sub">
              Over all {was.rounds} rounds the biggest leak was {was.label.toLowerCase()} ({signedFor(was.sgPerRound, was.sample)}).
              Lately it is this one instead.
            </p>
          )}
        </>
      )}
      {z.lean && (
        <p className="small focus-lean">
          {z.lean.n} of {z.lean.of} tagged misses from here {LEAN_TEXT[z.lean.lean]}.
          {readMiss && surface === 'indoor' && ' A mat has too little break to train the read, so that part waits for a green.'}
        </p>
      )}
      {holding ? (
        <>
          <p className="small focus-lean">
            You beat scratch from here, so there is nothing to fix. The strokes are going somewhere else.
          </p>
          {toWorst && (
            <button className="btn btn-wide" style={{ marginTop: 12 }} onClick={toWorst}>
              Show the biggest leak
            </button>
          )}
        </>
      ) : (
        <>
          {why.length > 0 && (
            <div className="why-list">
              <span className="why-h">What's behind it</span>
              {isLagZone(z.zone) && (
                <span className="small muted">
                  From all your putts of 16 ft and out together, since lag goes wrong the same way at any length.
                </span>
              )}
              {why.map((w) => (
                <div key={w.slice.cond} className="why-item">
                  <strong>
                    {COND_LABEL[w.slice.cond]}: {w.slice.made} of {w.slice.attempts}{' '}
                    {isLagZone(z.zone) ? 'finished within 3 ft' : 'holed'}
                  </strong>
                  <span className="small muted">
                    {Math.round((w.slice.made / w.slice.attempts) * 100)}% against{' '}
                    {Math.round((w.slice.restMade / w.slice.restAttempts) * 100)}% on your other tagged putts from here
                    {w.slice.lean ? `. ${w.slice.lean.n} of ${w.slice.lean.of} tagged misses ${LEAN_TEXT[w.slice.lean.lean]}` : ''}.{' '}
                    {-w.slice.gap > w.slice.margin ? 'Bigger than chance.' : `A lead so far, on ${w.slice.attempts} putts.`}
                  </span>
                  <DrillRow d={w.fix} last={lastOf(w.fix.id)} onPick={onRoll} fix />
                  {w.track && <span className="small why-track">{w.track}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="focus-drills">
            {drills.map((d) => (
              <DrillRow key={d.id} d={d} last={lastOf(d.id)} onPick={onRoll} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The plain numbers under the strokes gained. Short putts are judged on holing them, long ones
 * on where they finish, so each zone gets the stats that fit it.
 */
export function ZoneStats({ z }: { z: ZoneRead }) {
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
  const cells = isLagZone(z.zone)
    ? [
        { v: z.leave !== null ? `${z.leave.toFixed(1)} ft` : '', k: 'Average leave' },
        { v: `${z.threePutts} of ${z.firstPutts}`, k: 'Three-putts' },
        { v: signedFor(z.sgPerPutt, z.sample), k: 'Per putt' },
      ]
    : [
        { v: `${pct(z.makes, z.attempts)}%`, k: `Holed, ${z.makes} of ${z.attempts}` },
        { v: `${pct(z.scratchMakes, z.attempts)}%`, k: 'A scratch golfer makes' },
        { v: signedFor(z.sgPerPutt, z.sample), k: 'Per putt' },
      ];
  return (
    <div className="zone-stats">
      {cells
        .filter((c) => c.v)
        .map((c) => (
          <div key={c.k}>
            <strong className="num">{c.v}</strong>
            <span>{c.k}</span>
          </div>
        ))}
    </div>
  );
}

/** Behind the target: where every stroke goes, what is behind the biggest leak, and the habits. */
export function PracticeWhy() {
  const plan = usePlan();
  const { state, surface, room, drills, fitted, family, focus, worst, whyOf, habits, pattern, patternFix, scope } = plan;
  const [picked, setPicked] = useState<Zone | null>(null);
  const [preview, setPreview] = useState<Fitted | null>(null);
  const [rolling, setRolling] = useState<Fitted | null>(null);

  const zone = focus.zones.find((z) => z.zone === (picked ?? focus.worst)) ?? null;
  const list = histories(state.practice, family);
  const lastOf = (id: string) => {
    const h = list.find((x) => x.drill === family(id));
    return h ? `Last ${setScoreShort(resolveDrill(state, id), h.last)}` : null;
  };
  const scratch = JSON.stringify(state.baseline) === JSON.stringify(DEFAULT_BASELINE);

  return (
    <div>
      <div className="page-top">
        <BackLink />
      </div>
      <h1 className="page-title">Why this</h1>
      {focus.rounds > 0 && (
        <p className="small muted" style={{ margin: '4px 0 0' }}>
          From {scope}. Distance is already accounted for: every putt is measured against{' '}
          {scratch ? 'scratch' : 'your baseline'} from the same spot.
        </p>
      )}

      {focus.rounds > 0 && zone && (
        <>
          <h2>Where the strokes go</h2>
          <ZoneBars zones={focus.zones} on={zone.zone} onPick={setPicked} />
          <p className="small muted" style={{ marginTop: 8 }}>
            Strokes a round. A wide zone holds more putts a round, so each row also says what one putt costs. Tap a
            distance to see it below.
          </p>
          <ZoneCard
            z={zone}
            worst={zone.zone === focus.worst}
            close={zone.zone === focus.worst ? (focus.zones.find((z) => z.zone === focus.close) ?? null) : null}
            was={
              zone.zone === focus.worst && focus.wasWorst
                ? { ...focus.wasWorst, rounds: focus.allRounds }
                : null
            }
            drills={drillsNear(drills, zone.zone, zone.lean?.lean ?? null, surface, room)}
            toWorst={worst && worst.zone !== zone.zone ? () => setPicked(worst.zone) : undefined}
            why={whyOf(zone)}
            surface={surface}
            lastOf={lastOf}
            onRoll={setPreview}
          />
        </>
      )}

      {habits.length > 0 && (
        <>
          <h2>Your stroke and reads</h2>
          <div className="row-list">
            {habits.map((h) => {
              const drill = fitted(h.fix);
              return (
                <div key={h.key + h.title} className="card habit">
                  <strong>{h.title}</strong>
                  <span className="small muted">{h.detail}</span>
                  {drill && <DrillRow d={drill} last={lastOf(drill.id)} onPick={setPreview} fix />}
                </div>
              );
            })}
          </div>
        </>
      )}

      {pattern && patternFix && (
        <>
          <h2>From your practice</h2>
          <div className="card habit">
            <strong>
              {pattern.band}, {SURFACE_LABELS[pattern.surface].toLowerCase()}
            </strong>
            <span className="small muted">
              {pattern.n} of your last {pattern.of} tagged misses went {pattern.dir}. {DIR_MEANS[pattern.dir]}
            </span>
            <DrillRow d={patternFix} last={lastOf(patternFix.id)} onPick={setPreview} fix />
          </div>
        </>
      )}

      {preview && (
        <DrillPreview
          drill={preview}
          onClose={() => setPreview(null)}
          onStart={() => {
            setRolling(preview);
            setPreview(null);
          }}
        />
      )}
      {rolling && <DrillLogger key={rolling.id} drill={rolling} surface={surface} onClose={() => setRolling(null)} />}
    </div>
  );
}
