import type { Venn } from '../lib/form';

/**
 * This was two overlapping circles with three bare numbers in them, and Conor read it and could
 * not tell what the numbers were. A diagram you have to decode from a caption underneath is a
 * worse version of the caption.
 *
 * So: the two sentences the circles were trying to draw, said outright. The middle of the Venn
 * was the boring cell anyway, putts both numbers agree about. These two are the disagreement,
 * which is the only reason the app carries two numbers at all.
 */
export function FormVenn({ venn }: { venn: Venn }) {
  const { gotAway, robbed } = venn;
  if (!gotAway && !robbed) return null;

  return (
    <>
      <div className="field-label">Where the two numbers disagree</div>
      <div className="card">
        <div className="stat-row">
          <span className="k">
            Went in off a bad stroke
            <span className="small muted"> · strokes gained paid you, Form did not</span>
          </span>
          <span className="v num">{gotAway}</span>
        </div>
        <div className="stat-row">
          <span className="k">
            Good stroke, did not drop
            <span className="small muted"> · Form paid you, strokes gained did not</span>
          </span>
          <span className="v num">{robbed}</span>
        </div>
      </div>
    </>
  );
}
