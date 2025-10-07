import { useState, useCallback, useRef, useEffect } from 'react';

export type LayerMode = "groups" | "votes" | "metrics";

interface UseLayerModeCyclingProps {
  currentLayerMode: LayerMode;
  pauseDuration?: number; // Time to pause at each layer state
  flashDuration?: number; // Fast fade out (flash)
  exposureDuration?: number; // Slow fade in (exposure)
}

interface UseLayerModeCyclingReturn {
  effectiveLayerMode: LayerMode;
  isCycling: boolean;
  cycleOpacity: number;
  canPaint: boolean;
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
  pauseDuration = 1000, // Long pause at each layer state
  flashDuration = 200, // Very fast fade out (flash)
  exposureDuration = 1000, // Slower fade in (exposure)
}: UseLayerModeCyclingProps): UseLayerModeCyclingReturn {
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

          // Slow fade in (exposure) - need to update transition duration
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

  // Determine if painting is allowed
  const canPaint = effectiveLayerMode === "groups" || isCycling;

  return {
    effectiveLayerMode,
    isCycling,
    cycleOpacity,
    canPaint,
    startCycle,
    stopCycle
  };
}