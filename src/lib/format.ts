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

export function signed(n: number, digits = 1): string {
  const v = n.toFixed(digits);
  return n > 0 ? `+${v}` : v;
}

export function pctText(v: number | null, digits = 0): string {
  return v === null ? '--' : `${v.toFixed(digits)}%`;
}

export function puttSequence(distances: { d: number; made: boolean }[]): string {
  if (!distances.length) return '';
  return distances.map((p, i) => (p.made && i === distances.length - 1 ? `${p.d} holed` : `${p.d}`)).join(' → ');
}
