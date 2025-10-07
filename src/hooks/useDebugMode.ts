import { useState, useEffect } from 'react';

// Global debug mode state
let globalDebugMode = false;
let debugModeListeners: Set<(enabled: boolean) => void> = new Set();

// Expose debug mode control to browser console
declare global {
  interface Window {
    enablePolisDebugMode: () => void;
    disablePolisDebugMode: () => void;
    togglePolisDebugMode: () => void;
    isPolisDebugModeEnabled: () => boolean;
  }
}

// Initialize console functions
if (typeof window !== 'undefined') {
  window.enablePolisDebugMode = () => {
    globalDebugMode = true;
    console.log('🐛 Polis Debug Mode: ENABLED');
    console.log('Debug mode will show vote statistics for each statement in group tabs.');
    debugModeListeners.forEach(listener => listener(true));
  };

  window.disablePolisDebugMode = () => {
    globalDebugMode = false;
    console.log('🐛 Polis Debug Mode: DISABLED');
    debugModeListeners.forEach(listener => listener(false));
  };

  window.togglePolisDebugMode = () => {
    if (globalDebugMode) {
      window.disablePolisDebugMode();
    } else {
      window.enablePolisDebugMode();
    }
  };

  window.isPolisDebugModeEnabled = () => {
    console.log(`🐛 Polis Debug Mode: ${globalDebugMode ? 'ENABLED' : 'DISABLED'}`);
    return globalDebugMode;
  };

  // Show help message on initial load
  console.log('🐛 Polis Debug Mode available! Use these console commands:');
  console.log('  enablePolisDebugMode()  - Enable debug mode');
  console.log('  disablePolisDebugMode() - Disable debug mode');
  console.log('  togglePolisDebugMode()  - Toggle debug mode');
  console.log('  isPolisDebugModeEnabled() - Check current state');
}

/**
 * Hook to use debug mode state in React components
 */
export function useDebugMode() {
  const [debugMode, setDebugMode] = useState(globalDebugMode);

  useEffect(() => {
    const listener = (enabled: boolean) => {
      setDebugMode(enabled);
    };

    debugModeListeners.add(listener);

    return () => {
      debugModeListeners.delete(listener);
    };
  }, []);

  return debugMode;
}