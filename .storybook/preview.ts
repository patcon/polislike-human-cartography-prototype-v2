import "../src/index.css"
import type { Preview } from '@storybook/react-vite'

/**
 * STORYBOOK URL PARAMETER WORKAROUND
 *
 * Problem: Storybook URL parameters are limited to alphanumeric characters, spaces,
 * underscores, and dashes. Values with periods (like URLs) get stripped from URL
 * parameters, preventing iframe.html fullscreen mode from working with args containing periods.
 *
 * Solution: Encode problematic characters when setting default args, then decode them
 * in story render functions.
 *
 * Usage in stories:
 * ```typescript
 * import { decodeStorybookArgs, encodeStorybookParam } from '../../../.storybook/preview';
 *
 * export const MyStory: Story = {
 *   render: (args) => {
 *     const decodedArgs = decodeStorybookArgs(args);
 *     return <MyComponent kedroBaseUrl={decodedArgs.kedroBaseUrl} />;
 *   },
 *   args: {
 *     kedroBaseUrl: encodeStorybookParam('https://patcon.github.io/kedro-polislike-pipelines'),
 *   },
 * };
 * ```
 *
 * Console Helper: When you enter a URL with periods in Storybook controls,
 * the console will show the encoded version you can copy for iframe.html URLs.
 */

const ENCODED_PERIOD = '__DOT__';
const ENCODED_COLON = '__COLON__';
const ENCODED_SLASH = '__SLASH__';

/**
 * Encode problematic characters for Storybook URL parameters
 * Converts: . → __DOT__, : → __COLON__, / → __SLASH__
 */
export function encodeStorybookParam(value: string): string {
  return value
    .replace(/\./g, ENCODED_PERIOD)
    .replace(/:/g, ENCODED_COLON)
    .replace(/\//g, ENCODED_SLASH);
}

/**
 * Decode parameters back to original values
 * Converts: __DOT__ → ., __COLON__ → :, __SLASH__ → /
 */
export function decodeStorybookParam(value: string): string {
  return value
    .replace(new RegExp(ENCODED_PERIOD, 'g'), '.')
    .replace(new RegExp(ENCODED_COLON, 'g'), ':')
    .replace(new RegExp(ENCODED_SLASH, 'g'), '/');
}

/**
 * Helper to decode args that may contain encoded values
 *
 * Automatically decodes specified arg keys and provides console logging
 * to help with copying encoded URLs for iframe.html use.
 *
 * To add new encoded parameters, add the key name to the encodedKeys array.
 */
export function decodeStorybookArgs(args: Record<string, any>): Record<string, any> {
  const decoded = { ...args };

  // List of arg keys that might contain encoded values
  const encodedKeys = ['kedroBaseUrl', 'pipelineId', 'baseUrl', 'url'];

  encodedKeys.forEach(key => {
    if (decoded[key] && typeof decoded[key] === 'string') {
      const originalValue = decoded[key];
      const decodedValue = decodeStorybookParam(originalValue);

      // If the value was decoded (changed), it means it was encoded
      if (decodedValue !== originalValue) {
        decoded[key] = decodedValue;
        console.log(`🔗 Storybook URL Helper - Decoded ${key}:`, decodedValue);
      } else {
        // If the value wasn't encoded but contains periods, show what the encoded version would be
        if (originalValue.includes('.') || originalValue.includes(':') || originalValue.includes('/')) {
          const encodedVersion = encodeStorybookParam(originalValue);
          console.log(`🔗 Storybook URL Helper - For URL use, encode "${key}" as:`, encodedVersion);
          console.log(`🔗 Full URL parameter: ${key}:${encodedVersion}`);
        }
      }
    }
  });

  return decoded;
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
      // Disable the "save changes" prompt globally to prevent performance issues
      disableSaveFromUI: true,
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
};

export default preview;
