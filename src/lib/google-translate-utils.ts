/**
 * Triggers Google Translate to re-scan specific elements or the entire page
 * @param selector - CSS selector for elements to refresh (default: all translate="yes" elements)
 * @param delay - Delay before triggering refresh (default: 100ms)
 */
export function refreshGoogleTranslate(
  selector: string = '[translate="yes"]',
  delay: number = 100
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    setTimeout(() => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          element.removeAttribute('translate');
          requestAnimationFrame(() => {
            element.setAttribute('translate', 'yes');
          });
        });
      } catch (error) {
        console.debug('Google Translate refresh failed:', error);
      }
      resolve();
    }, delay);
  });
}