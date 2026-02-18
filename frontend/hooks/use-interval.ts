import { useEffect, useRef } from 'react';

/**
 * Custom hook that creates a declarative setInterval with auto-cleanup.
 * Uses useRef to always call the latest callback, avoiding stale closures.
 *
 * @param callback - Function to execute at each interval
 * @param delayMs - Delay in milliseconds. If null, the interval is paused.
 */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const savedCallback = useRef<() => void>(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => savedCallback.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}