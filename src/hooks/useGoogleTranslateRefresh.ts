import { useEffect, type DependencyList } from 'react';
import { refreshGoogleTranslate } from '@/lib/google-translate-utils';

/**
 * Custom hook to trigger Google Translate re-scan when content changes
 * @param dependencies - Array of dependencies that should trigger re-scan
 * @param selector - CSS selector for elements to refresh (default: all translate="yes" elements)
 * @param delay - Delay in ms before triggering re-scan (default: 100)
 */
export function useGoogleTranslateRefresh(
  dependencies: DependencyList,
  selector?: string,
  delay?: number
) {
  useEffect(() => {
    refreshGoogleTranslate(selector, delay);
  }, dependencies);
}