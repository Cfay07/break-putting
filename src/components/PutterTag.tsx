import { useApp } from '../lib/store';
import { brandPill } from '../lib/types';

export function PutterTag({ putterId }: { putterId: string }) {
  const { state } = useApp();
  const putter = state.putters.find((p) => p.id === putterId);
  if (!putter) return <span className="tag">Unknown putter</span>;

  const pill = brandPill(putter.name);
  const style = pill ? { background: pill.bg, borderColor: pill.bg, color: pill.ink } : undefined;

  return (
    <span className="tag" style={style}>
      {putter.name}
    </span>
  );
}
