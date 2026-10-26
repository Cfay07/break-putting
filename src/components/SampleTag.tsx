import { confidenceOf, sampleLabel, type Sample } from '../lib/sample';

/**
 * What a number stands on, next to the number rather than in a footnote. Solid is quiet because
 * it is the normal case; thin and waiting earn the eye, because those are the ones a reader
 * would otherwise trust too much.
 */
export function SampleTag({ s }: { s: Sample }) {
  const c = confidenceOf(s);
  return (
    <span className={`samp samp-${c}`} title={`${s.n} of ${s.need} ${s.unit} needed`}>
      {sampleLabel(s)}
      {c === 'thin' && <span className="samp-flag"> · thin</span>}
      {c === 'waiting' && <span className="samp-flag"> · not yet</span>}
    </span>
  );
}
