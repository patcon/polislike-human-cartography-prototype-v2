import { useState, useEffect, useCallback } from 'react';

type UseShiftKeyTempModeProps = {
  currentMode: "move-map" | "paint-groups";
  onModeChange: (mode: "move-map" | "paint-groups") => void;
};

type UseShiftKeyTempModeReturn = {
  isShiftPressed: boolean;
  effectiveMode: "move-map" | "paint-groups";
};

/**
 * Custom hook to handle temporary mode switching when shift key is held.
 * When shift is pressed and current mode is not "move-map", temporarily switches to "move-map".
 * When shift is released, reverts back to the original mode.
 * Has no effect when move tool is already selected.
 */
export function useShiftKeyTempMode({ 
  currentMode, 
  onModeChange 
}: UseShiftKeyTempModeProps): UseShiftKeyTempModeReturn {
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [originalMode, setOriginalMode] = useState<"move-map" | "paint-groups" | null>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only handle keyboard shortcuts when not typing in an input field
    if (event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement) {
      return;
    }

    if (event.key === 'Shift' && !isShiftPressed) {
      setIsShiftPressed(true);

      // Only switch to move mode if we're not already in move mode
      if (currentMode !== "move-map") {
        setOriginalMode(currentMode);
        onModeChange("move-map");
      }
    }
  }, [isShiftPressed, currentMode, onModeChange]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Shift' && isShiftPressed) {
      setIsShiftPressed(false);

      // Revert to original mode if we had switched temporarily
      if (originalMode !== null) {
        onModeChange(originalMode);
        setOriginalMode(null);
      }
    }
  }, [isShiftPressed, originalMode, onModeChange]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Cleanup function to handle cases where shift is released outside the window
    const handleWindowBlur = () => {
      if (isShiftPressed && originalMode !== null) {
        setIsShiftPressed(false);
        onModeChange(originalMode);
        setOriginalMode(null);
      }
    };

    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [handleKeyDown, handleKeyUp, isShiftPressed, originalMode, onModeChange]);

  // Calculate effective mode
  const effectiveMode = currentMode;

  return {
    isShiftPressed,
    effectiveMode
  };
}