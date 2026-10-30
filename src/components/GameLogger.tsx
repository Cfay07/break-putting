import { useState } from 'react';
import { byTime } from '../lib/practice';
import { useApp } from '../lib/store';
import type { LoggerProps } from './DrillLogger';

/** Head to head. Who, who won, and the points only if you want them. */
export function GameLogger({ drill, onSave }: LoggerProps) {
  const { state } = useApp();
  const known = [
    ...new Set(
      [...state.practice]
        .filter((s) => s.game)
        .sort((a, b) => byTime(b, a))
        .map((s) => s.game!.opponent),
    ),
  ];
  const [who, setWho] = useState(known[0] ?? '');
  const [typing, setTyping] = useState(!known.length);
  const [points, setPoints] = useState(false);
  const [mine, setMine] = useState('');
  const [theirs, setTheirs] = useState('');
  const name = who.trim();

  const save = (result: 'win' | 'loss' | 'tie') =>
    onSave({
      made: result === 'win' ? 1 : 0,
      attempts: 1,
      game: {
        opponent: name,
        result,
        ...(points && mine !== '' && theirs !== '' ? { mine: Number(mine), theirs: Number(theirs) } : {}),
      },
    });

  return (
    <div className="runner-body">
      <p className="small muted">{drill.how}</p>
      <span className="field-label">Against</span>
      <div className="chips">
        {known.map((k) => (
          <button
            key={k}
            className={!typing && who === k ? 'chip chip-sel' : 'chip'}
            onClick={() => {
              setWho(k);
              setTyping(false);
            }}
          >
            {k}
          </button>
        ))}
        {known.length > 0 && (
          <button
            className={typing ? 'chip chip-sel' : 'chip'}
            onClick={() => {
              setWho('');
              setTyping(true);
            }}
          >
            Someone else
          </button>
        )}
      </div>
      {typing && (
        <input
          className="game-name"
          placeholder="Their name"
          value={who}
          onChange={(e) => setWho(e.target.value)}
          aria-label="Opponent's name"
        />
      )}
      {points && (
        <div className="runner-typed">
          <label>
            <span className="field-label">Your points</span>
            <input inputMode="numeric" value={mine} onChange={(e) => setMine(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label>
            <span className="field-label">{name || 'Their'} points</span>
            <input inputMode="numeric" value={theirs} onChange={(e) => setTheirs(e.target.value.replace(/\D/g, ''))} />
          </label>
        </div>
      )}
      <div className="game-btns">
        <button className="runner-yes" disabled={!name} onClick={() => save('win')}>
          I won
        </button>
        <button className="game-tie" disabled={!name} onClick={() => save('tie')}>
          Tie
        </button>
        <button className="runner-no" disabled={!name} onClick={() => save('loss')}>
          {name ? `${name} won` : 'They won'}
        </button>
      </div>
      {!points && (
        <button className="linkish small muted runner-link" onClick={() => setPoints(true)}>
          Add the points too
        </button>
      )}
    </div>
  );
}
