/**
 * Keyboard event handling module
 * Provides functions for managing keyboard event listeners
 */

export type KeyboardListener = {
  readonly key: string;
  readonly cleanup: () => void;
};

/**
 * Create a keyboard event listener for a specific key
 * Returns Error if event listener setup fails
 */
export function createKeyboardListener(key: string, handler: () => void): KeyboardListener | Error {
  const normalizedKey = key.toLowerCase();
  
  const keydownHandler = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() === normalizedKey) {
      event.preventDefault();
      handler();
    }
  };

  try {
    document.addEventListener('keydown', keydownHandler);
  } catch (e) {
    return new Error(`Failed to add keydown event listener for key: ${key}`);
  }

  const cleanup = (): void => {
    try {
      document.removeEventListener('keydown', keydownHandler);
    } catch (e) {
      // Silently ignore cleanup errors as the listener may already be removed
    }
  };

  return {
    key: normalizedKey,
    cleanup,
  };
}

/**
 * Clean up a keyboard listener by removing its event listener
 */
export function cleanupKeyboardListener(listener: KeyboardListener): void {
  listener.cleanup();
}