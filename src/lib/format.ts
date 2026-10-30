export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}`;
}

export function fmtDateLong(iso: string): string {
  const [y] = iso.split('-');
  return `${fmtDate(iso)}, ${y}`;
}

export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Strokes, signed. Two places by default: a twentieth of a stroke is a real difference in
 * putting and a single place was rounding it away. Never three, which is precision this
 * measurement does not have.
 */
export function signed(n: number, digits = 2): string {
  const v = n.toFixed(digits);
  // Rounded to nothing, it has no side: -0.04 at one decimal is 0.0, not -0.0.
  if (Number(v) === 0) return v.replace('-', '');
  return n > 0 ? `+${v}` : v;
}

export function pctText(v: number | null, digits = 0): string {
  return v === null ? '--' : `${v.toFixed(digits)}%`;
}

export function puttSequence(distances: { d: number; made: boolean }[]): string {
  if (!distances.length) return '';
  return distances.map((p, i) => (p.made && i === distances.length - 1 ? `${p.d} holed` : `${p.d}`)).join(' → ');
}
