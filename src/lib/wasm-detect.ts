/**
 * Check if WebAssembly is available in the current browser environment.
 *
 * WebAssembly can be disabled by browser "Lockdown Mode" settings
 * (e.g. Chrome iOS Lockdown Mode, iOS system Lockdown Mode) or
 * by content blockers / security extensions.
 */
export function isWebAssemblySupported(): boolean {
  return typeof WebAssembly !== 'undefined';
}
