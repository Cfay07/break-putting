import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  err: Error | null;
  where: string;
}

/**
 * A render failure used to leave a white screen with no way back and nothing to report.
 *
 * Nothing here tries to recover the broken screen. It keeps the rest of the app reachable, shows
 * what actually threw, and says plainly that no round was lost, because a blank phone after
 * finishing eighteen holes reads like the round went with it. Everything is already written to
 * this device before any of this renders.
 */
export class Boundary extends Component<{ children: ReactNode }, State> {
  state: State = { err: null, where: '' };

  static getDerivedStateFromError(err: Error): Partial<State> {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    this.setState({ where: (info.componentStack ?? '').split('\n').slice(1, 4).join('\n').trim() });
    // Kept on the device so a crash seen on the course can still be read afterwards.
    try {
      const log = JSON.parse(localStorage.getItem('break.crashes') ?? '[]');
      log.unshift({ at: new Date().toISOString(), message: err.message, stack: err.stack?.slice(0, 1200) });
      localStorage.setItem('break.crashes', JSON.stringify(log.slice(0, 5)));
    } catch {
      // A full or blocked store must not turn a crash report into a second crash.
    }
  }

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="crash">
        <h2>That screen broke</h2>
        <p className="crash-lead">
          <b>Your round is safe.</b> Everything is written to this phone as you play, before any of
          this is drawn. Nothing was lost by this.
        </p>
        <pre className="crash-why">{this.state.err.message}</pre>
        {this.state.where && <pre className="crash-where">{this.state.where}</pre>}
        <button className="btn btn-primary btn-wide" onClick={() => { window.location.hash = '/'; window.location.reload(); }}>
          Back to rounds
        </button>
      </div>
    );
  }
}
