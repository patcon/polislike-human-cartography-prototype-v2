import { useState, useCallback, useRef, useEffect } from 'react';

export type LayerMode = "groups" | "votes" | "metrics";

interface UseLayerModeCyclingProps {
  currentLayerMode: LayerMode;
}

interface UseLayerModeCyclingReturn {
  effectiveLayerMode: LayerMode;
  isCycling: boolean;
  cycleOpacity: number;
  startCycle: () => void;
  stopCycle: () => void;
}

/**
 * Hook to manage layer mode cycling for painting functionality.
 * Provides manual control to start/stop cycling between current layer mode
 * and groups mode with fade transitions during lasso events.
 */
export function useLayerModeCycling({
  currentLayerMode,
}: UseLayerModeCyclingProps): UseLayerModeCyclingReturn {
  // Fixed timing values for camera flash effect
  const pauseDuration = 1000; // Pause at each layer state
  const flashDuration = 200; // Fast fade out (flash)
  const exposureDuration = 1000; // Slower fade in (exposure)
  const [isCycling, setIsCycling] = useState(false);
  const [cycleOpacity, setCycleOpacity] = useState(1);
  const [effectiveLayerMode, setEffectiveLayerMode] = useState<LayerMode>(currentLayerMode);

  const cycleTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Update effective layer mode when current layer mode changes (only when not cycling)
  useEffect(() => {
    if (!isCycling) {
      setEffectiveLayerMode(currentLayerMode);
    }
    // Note: When cycling, we let the cycle control the effectiveLayerMode
    // If user actually changes layer mode while cycling, the cycle will naturally stop
    // when the lasso ends and the new layer mode will take effect
  }, [currentLayerMode, isCycling]);

  const startCycle = useCallback(() => {
    if (isCycling || currentLayerMode === "groups") {
      return;
    }

    setIsCycling(true);

    let cycleCount = 0;
    let isActive = true; // Use local flag instead of state

    const performContinuousCycle = () => {
      if (!isActive) {
        return;
      }

      cycleCount++;
      const isGroupsPhase = cycleCount % 2 === 1;

      // Start with a pause at current state, then fade out
      cycleTimeoutRef.current = setTimeout(() => {
        if (!isActive) {
          return;
        }

        // Fast fade out (flash)
        setCycleOpacity(0);

        // After fast fade out, switch layer and slow fade in
        fadeTimeoutRef.current = setTimeout(() => {
          if (isGroupsPhase) {
            setEffectiveLayerMode("groups");
          } else {
            setEffectiveLayerMode(currentLayerMode);
          }

          // Update transition for slow fade in (exposure)
          const element = document.querySelector('[data-layer-cycling]') as HTMLElement;
          if (element) {
            element.style.transition = `opacity ${exposureDuration}ms ease-out`;
          }

          setCycleOpacity(1);

          // Pause at full opacity, then continue cycling
          cycleTimeoutRef.current = setTimeout(() => {
            // Reset to fast transition for next fade out
            if (element) {
              element.style.transition = `opacity ${flashDuration}ms ease-in`;
            }
            performContinuousCycle();
          }, exposureDuration);
        }, flashDuration); // Wait for fast fade out to complete
      }, pauseDuration);
    };

    // Store cleanup function to stop the cycle
    const cleanup = () => {
      isActive = false;
      if (cycleTimeoutRef.current) {
        clearTimeout(cycleTimeoutRef.current);
        cycleTimeoutRef.current = undefined;
      }
    };

    // Store cleanup in ref so stopCycle can access it
    (cycleTimeoutRef as any).cleanup = cleanup;

    // Start the continuous cycle
    performContinuousCycle();
  }, [currentLayerMode, isCycling, pauseDuration, flashDuration, exposureDuration]);

  const stopCycle = useCallback(() => {
    // Always call cleanup function if it exists, regardless of isCycling state
    if ((cycleTimeoutRef as any).cleanup) {
      (cycleTimeoutRef as any).cleanup();
      (cycleTimeoutRef as any).cleanup = null;
    }

    // Always clear timeouts, regardless of isCycling state
    if (cycleTimeoutRef.current) {
      clearTimeout(cycleTimeoutRef.current);
      cycleTimeoutRef.current = undefined;
    }
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = undefined;
    }

    // Always reset state, regardless of isCycling state
    setEffectiveLayerMode(currentLayerMode);
    setCycleOpacity(1);
    setIsCycling(false);
  }, [currentLayerMode, isCycling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cycleTimeoutRef.current) {
        clearTimeout(cycleTimeoutRef.current);
      }
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, []);

  return {
    effectiveLayerMode,
    isCycling,
    cycleOpacity,
    startCycle,
    stopCycle
  };
}