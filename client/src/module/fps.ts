/**
 * FPS (Frames Per Second) calculation module
 * Provides functions for tracking frame times and calculating rolling average FPS
 */

export type FPSState = {
  readonly frameTimes: ReadonlyArray<number>;
  readonly lastUpdateTime: number;
  readonly currentFPS: number;
  readonly isVisible: boolean;
};

export type FPSConfig = {
  readonly bufferSize: number;  // Number of frames to track for rolling average (typically 60)
  readonly updateInterval: number;  // How often to update display in milliseconds (typically 1000)
};

/**
 * Create initial FPS state with empty frame times buffer
 */
export function createInitialFPSState(_config: FPSConfig): FPSState {
  return {
    frameTimes: [],
    lastUpdateTime: 0,
    currentFPS: 0,
    isVisible: false,
  };
}

/**
 * Update frame time tracking with a new frame timestamp
 * Maintains a rolling buffer of frame times for average calculation
 */
export function updateFrameTime(state: FPSState, currentTime: number): FPSState {
  const newFrameTimes = state.frameTimes.length === 0 
    ? [currentTime]
    : [...state.frameTimes, currentTime].slice(-60); // Keep only last 60 frame times

  return {
    ...state,
    frameTimes: newFrameTimes,
  };
}

/**
 * Calculate rolling average FPS from frame times array
 * Returns 0 if insufficient data is available
 */
export function calculateRollingAverage(frameTimes: ReadonlyArray<number>): number {
  if (frameTimes.length < 2) {
    return 0;
  }

  const lastTime = frameTimes[frameTimes.length - 1];
  const firstTime = frameTimes[0];
  
  if (lastTime === undefined || firstTime === undefined) {
    return 0;
  }

  const totalTime = lastTime - firstTime;
  const frameCount = frameTimes.length - 1;
  
  if (totalTime <= 0) {
    return 0;
  }

  return Math.round((frameCount * 1000) / totalTime);
}

/**
 * Check if the display should be updated based on update interval
 */
export function shouldUpdateDisplay(
  state: FPSState, 
  currentTime: number, 
  config: FPSConfig
): boolean {
  return currentTime - state.lastUpdateTime >= config.updateInterval;
}

/**
 * Update FPS state with new calculated FPS value and update timestamp
 */
export function updateFPSDisplay(
  state: FPSState, 
  currentTime: number, 
  newFPS: number
): FPSState {
  return {
    ...state,
    currentFPS: newFPS,
    lastUpdateTime: currentTime,
  };
}

/**
 * Toggle the visibility state of the FPS counter
 */
export function toggleVisibility(state: FPSState): FPSState {
  return {
    ...state,
    isVisible: !state.isVisible,
  };
}