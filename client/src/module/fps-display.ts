/**
 * FPS Display module
 * Manages HTML DOM elements for displaying FPS counter
 */

export type FPSDisplayElement = {
  readonly element: HTMLDivElement;
  readonly textNode: Text;
};

/**
 * Create the HTML elements for FPS display
 * Returns Error if DOM manipulation fails
 */
export function createFPSDisplay(): FPSDisplayElement | Error {
  let element: HTMLDivElement;
  try {
    element = document.createElement('div');
  } catch (e) {
    return new Error('Failed to create div element');
  }

  element.className = 'fps-counter';
  element.style.display = 'none'; // Initially hidden

  let textNode: Text;
  try {
    textNode = document.createTextNode('FPS: 0');
  } catch (e) {
    return new Error('Failed to create text node');
  }

  try {
    element.appendChild(textNode);
  } catch (e) {
    return new Error('Failed to append text node to element');
  }

  try {
    document.body.appendChild(element);
  } catch (e) {
    return new Error('Failed to append FPS display to document body');
  }

  return {
    element,
    textNode,
  };
}

/**
 * Update the FPS display with a new FPS value
 */
export function updateFPSDisplay(display: FPSDisplayElement, fps: number): void {
  display.textNode.textContent = `FPS: ${fps}`;
}

/**
 * Set the visibility of the FPS display
 */
export function setFPSDisplayVisibility(display: FPSDisplayElement, isVisible: boolean): void {
  display.element.style.display = isVisible ? 'block' : 'none';
}

/**
 * Remove the FPS display from the DOM and clean up resources
 */
export function destroyFPSDisplay(display: FPSDisplayElement): void {
  try {
    if (display.element.parentNode) {
      display.element.parentNode.removeChild(display.element);
    }
  } catch (e) {
    // Silently ignore removal errors as the element may already be removed
  }
}