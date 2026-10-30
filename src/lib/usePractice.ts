import { useMemo } from 'react';
import { allDrills, familyOf, fitToRoom, resolveDrill, type Fitted } from './drills';
import { scopeRounds } from './practice';
import { useApp } from './store';
import { DEFAULT_ROOM, type Surface } from './types';

/** What every practice screen needs: where you are, how much room it has, and your drills fitted to it. */
export function usePractice() {
  const { state, dispatch } = useApp();
  const surface: Surface = state.surface ?? 'indoor';
  const room = { ...DEFAULT_ROOM, ...state.room }[surface];
  const putterId = state.putters.find((p) => p.active)?.id;
  const scoped = useMemo(() => scopeRounds(state.rounds, putterId), [state.rounds, putterId]);
  const family = (id: string) => familyOf(state, id);
  const fitted = (id: string): Fitted | null => {
    const d = resolveDrill(state, id);
    return d ? fitToRoom(d, room) : null;
  };
  return { state, dispatch, surface, room, putterId, scoped, family, fitted, drills: allDrills(state) };
}
