/**
 * Scorecard shorthand: circles under par, boxes over, nested once per stroke.
 * Birdie one circle, eagle two. Bogey one box, double two, triple three.
 */
export function Mark({ strokes, vsPar }: { strokes: number; vsPar?: number }) {
  const n = <span className="mk-n">{strokes}</span>;
  if (vsPar === undefined || vsPar === 0) return n;
  const rings = Math.min(Math.abs(vsPar), 3);
  const shape = vsPar < 0 ? 'mk ci' : 'mk sq';
  let node = n;
  for (let i = 0; i < rings; i++) node = <span className={shape}>{node}</span>;
  return node;
}

/** The scorecard cell: a mark, or an empty cell when the hole has no score yet. */
export function ScoreMark({ strokes, vsPar }: { strokes?: number; vsPar?: number }) {
  if (strokes === undefined) return <span className="sc num" />;
  return (
    <span className="sc num">
      <Mark strokes={strokes} vsPar={vsPar} />
    </span>
  );
}
