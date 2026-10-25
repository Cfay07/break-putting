import type { Venn } from '../lib/form';

/**
 * Two circles, deliberately small. The interesting part is the two crescents: putts that went in
 * off a fault, which strokes gained pays for and Form does not, and clean strokes that stayed
 * out, which Form pays for and strokes gained does not. Those corners are the only reason the
 * app carries two numbers, and one glance should be enough to see them.
 *
 * Drawn only when at least one of the corners has something in it. Two circles meeting on
 * nothing is decoration.
 */
export function FormVenn({ venn }: { venn: Venn }) {
  const { earned, gotAway, robbed, deserved } = venn;
  if (!gotAway && !robbed) return null;

  return (
    <div className="venn">
      <svg viewBox="0 0 168 76" width="168" height="76" role="img"
        aria-label={`${gotAway} holed off a fault, ${earned} holed cleanly, ${robbed} clean strokes missed`}>
        <circle cx="62" cy="38" r="31" className="venn-a" />
        <circle cx="106" cy="38" r="31" className="venn-b" />
        <text x="40" y="43" className="venn-n">{gotAway}</text>
        <text x="84" y="43" className="venn-n venn-mid">{earned}</text>
        <text x="128" y="43" className="venn-n">{robbed}</text>
      </svg>
      <p className="small muted venn-key">
        <b>{gotAway}</b> went in off a fault, <b>{earned}</b> holed clean, <b>{robbed}</b> struck
        clean and stayed out
        {deserved ? `, ${deserved} missed and earned it` : ''}. The left and right are where the
        two numbers disagree.
      </p>
    </div>
  );
}
