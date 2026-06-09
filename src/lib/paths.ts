/**
 * Utility functions for resolving asset paths in different environments
 */

/**
 * Get the base path for the application
 * This handles both development/Storybook (no base path) and production GitHub Pages (with base path)
 */
function getBasePath(): string {
  // Check if we're in Storybook environment
  const isStorybook = typeof window !== 'undefined' &&
    (window.location.pathname.includes('/iframe.html') ||
     window.location.pathname.includes('/?path=') ||
     // @ts-expect-error - Storybook sets this global
     window.__STORYBOOK_ADDONS_MANAGER__ !== undefined);

  // Check if we're in Chromatic environment
  const isChromatic = typeof window !== 'undefined' &&
    window.location.hostname.includes('chromatic.com');

  // In development, Storybook, or localhost, there's no base path
  if (import.meta.env.DEV || isStorybook ||
      (typeof window !== 'undefined' &&
       (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'))) {
    return '';
  }

  // Special handling for Chromatic - it serves static files differently
  if (isChromatic) {
    return '';
  }

  // For production builds, check if we have a base path from the build configuration
  // The base path is set in vite.config.ts based on VITE_GITHUB_REPO_NAME
  const base = import.meta.env.BASE_URL || '/';

  // Remove trailing slash if it's not just '/'
  return base === '/' ? '' : base.replace(/\/$/, '');
}

/**
 * Resolve a public asset path to work in both development and production
 * @param path - The path to the asset (e.g., '/projections.json')
 * @returns The resolved path that works in the current environment
 */
export function resolveAssetPath(path: string): string {
  const basePath = getBasePath();

  // Remove leading slash from path if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Combine base path with clean path
  return basePath ? `${basePath}/${cleanPath}` : `/${cleanPath}`;
}

/**
 * Get the full URL for an asset
 * @param path - The path to the asset (e.g., '/projections.json')
 * @returns The full URL including origin and base path
 */
export function getAssetUrl(path: string): string {
  const resolvedPath = resolveAssetPath(path);
  return `${window.location.origin}${resolvedPath}`;
}