import { useEffect, useRef, useState } from "react";

/**
 * Smoothly interpolates displayed coordinates toward a moving target using
 * requestAnimationFrame. The rAF loop runs only while target is non-null,
 * and always chases the latest target via a ref so it doesn't restart on
 * every update.
 *
 * @param target - The current target coords, or null to clear.
 * @param factor - Lerp factor per frame (0–1). Higher = snappier. Default 0.15.
 */
export function useLerpedCoords(
  target: [number, number][] | null,
  factor = 0.15,
): [number, number][] | null {
  const [displayed, setDisplayed] = useState<[number, number][] | null>(null);
  const targetRef = useRef(target);
  targetRef.current = target;

  const isActive = target !== null;

  useEffect(() => {
    if (!isActive) {
      setDisplayed(null);
      return;
    }

    let rafId: number;
    const step = () => {
      const t = targetRef.current;
      if (!t) { setDisplayed(null); return; }
      setDisplayed(prev => {
        if (!prev || prev.length !== t.length) return t;
        return t.map(([tx, ty], i) => [
          prev[i][0] + (tx - prev[i][0]) * factor,
          prev[i][1] + (ty - prev[i][1]) * factor,
        ]) as [number, number][];
      });
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isActive, factor]);

  return displayed;
}
