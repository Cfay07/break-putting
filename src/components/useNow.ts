import { useEffect, useState } from 'react';

/** The current time, refreshed while `on`, for clocks that count down on screen. */
export function useNow(on: boolean, every = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [on, every]);
  return now;
}
