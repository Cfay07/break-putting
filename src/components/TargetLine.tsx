import { go } from '../lib/router';
import { useTarget } from '../lib/useTarget';

/**
 * The pinned practice target, in one quiet line. Every screen that used to offer its own "practice
 * this" names the same target in the same words instead, and the session itself starts on the
 * Practice tab, so there is one plan and one button for it.
 */
export function TargetLine() {
  const target = useTarget();
  if (!target.key || !target.title) return null;
  return (
    <button className="target-line" onClick={() => go('/practice')}>
      <span className="tl-what">
        Your target · <b>{target.title}</b>
      </span>
      <span className="tl-go">Practice ›</span>
    </button>
  );
}
