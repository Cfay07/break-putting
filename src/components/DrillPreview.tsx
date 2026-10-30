import { Sheet } from './Sheet';
import { distanceText, familyOf, scoringLabel, type Fitted } from '../lib/drills';
import { historyOf } from '../lib/practice';
import { ON_MISS_TEXT, setScore } from '../lib/practiceView';
import { useApp } from '../lib/store';
import { TEST_ID } from '../lib/weeklyTest';

/**
 * What a drill is before you are inside it. Tapping a drill used to drop you straight into the
 * counter, which is the wrong surprise when all you wanted was to see what it was.
 */
export function DrillPreview({ drill, onStart, onClose }: { drill: Fitted; onStart: () => void; onClose: () => void }) {
  const { state } = useApp();
  const family = (id: string) => familyOf(state, id);
  const h = historyOf(state.practice, family(drill.id), family);
  const moved = [...new Set(drill.stations.filter((s) => s.movedFrom).map((s) => s.movedFrom))];
  return (
    <Sheet title={drill.name} onClose={onClose}>
      <p className="small muted" style={{ margin: 0 }}>
        {[distanceText(drill), scoringLabel(drill), drill.minutes ? `${drill.minutes} min` : ''].filter(Boolean).join(' · ')}
      </p>
      <p style={{ margin: '12px 0 0' }}>
        {drill.how}
        {drill.scoring === 'ladder' && ` ${ON_MISS_TEXT[drill.onMiss ?? 'end']}`}
      </p>
      {moved.length > 0 && (
        <p className="small note-line">
          Fitted to your space: {moved.join(', ')} ft moved in to {Math.max(...drill.stations.map((s) => s.d))}.
        </p>
      )}
      {h && (
        <div className="preview-history">
          <div>
            <strong className="num">{setScore(drill, h.last)}</strong>
            <span>Last time</span>
          </div>
          <div>
            <strong className="num">{setScore(drill, h.best)}</strong>
            <span>Your best</span>
          </div>
        </div>
      )}
      <button className="btn btn-primary btn-wide" style={{ marginTop: 16 }} onClick={onStart}>
        Start
      </button>
      {drill.id !== TEST_ID && (
        <a className="btn btn-ghost btn-wide" style={{ marginTop: 8 }} href={`#/practice/drill/${family(drill.id)}`}>
          Everything about this drill
        </a>
      )}
    </Sheet>
  );
}
