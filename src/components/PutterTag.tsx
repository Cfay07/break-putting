import { useApp } from '../lib/store';
import { inkOn } from '../lib/types';

export function PutterTag({ putterId }: { putterId: string }) {
  const { state } = useApp();
  const putter = state.putters.find((p) => p.id === putterId);
  if (!putter) return <span className="tag">Unknown putter</span>;

  const style = putter.color
    ? { background: putter.color, borderColor: putter.color, color: inkOn(putter.color) }
    : undefined;

  return (
    <span className="tag" style={style}>
      {putter.name}
    </span>
  );
}
