// frontend/src/hooks/use-now.ts
//
// the current time as state, refreshed on an interval. reading the clock during render
// gives a different answer on every render, and a screen left open would never notice an
// offer expiring or a class finishing

import { useEffect, useState } from 'react';

export const useNow = (intervalMs = 60_000): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
};