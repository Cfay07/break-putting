import { BackLink } from '../components/BackLink';
import { SessionRow } from './Practice';
import { usePractice } from '../lib/usePractice';
import { SURFACE_LABELS } from '../lib/types';

export function SessionList() {
  const { state, surface, room } = usePractice();
  return (
    <div>
      <div className="page-top">
        <BackLink />
        <a href="#/practice/session-edit/new" className="back-link">
          New session
        </a>
      </div>
      <h1 className="page-title">Sessions</h1>
      <p className="small muted" style={{ margin: '2px 0 12px' }}>
        {SURFACE_LABELS[surface]}, up to {room} ft.
      </p>
      <div className="row-list">
        {state.sessions.map((x) => (
          <SessionRow key={x.id} id={x.id} />
        ))}
      </div>
    </div>
  );
}
