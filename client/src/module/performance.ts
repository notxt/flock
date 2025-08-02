// Performance Monitoring Module for Flock Simulation
// Following strict TypeScript functional programming patterns from CLAUDE.md

import type {
  PerformanceMetrics,
  PerformanceSample,
  PerformanceMonitor,
} from "./types.js";

// Default performance monitoring window size (number of samples to keep)
const DEFAULT_WINDOW_SIZE = 60; // 60 samples for 1 second at 60fps

// Pure function to create a new performance monitor
export function createPerformanceMonitor(windowSize: number = DEFAULT_WINDOW_SIZE): PerformanceMonitor {
  return {
    samples: [],
    windowSize,
    lastUpdateTime: performance.now(),
  };
}

// Pure function to add a new performance sample
export function addPerformanceSample(
  monitor: PerformanceMonitor,
  timestamp: number
): PerformanceMonitor {
  const frameTime = timestamp - monitor.lastUpdateTime;
  
  const newSample: PerformanceSample = {
    timestamp,
    frameTime,
  };

  // Add new sample and maintain window size
  const updatedSamples = [...monitor.samples, newSample].slice(-monitor.windowSize);

  return {
    ...monitor,
    samples: updatedSamples,
    lastUpdateTime: timestamp,
  };
}

// Pure function to calculate performance metrics from samples
export function calculatePerformanceMetrics(monitor: PerformanceMonitor): PerformanceMetrics {
  if (monitor.samples.length === 0) {
    return {
      fps: 0,
      frameTime: 0,
      averageFps: 0,
      minFps: 0,
      maxFps: 0,
      sampleCount: 0,
    };
  }

  // Get the most recent sample
  const latestSample = monitor.samples[monitor.samples.length - 1];
  if (!latestSample) {
    return {
      fps: 0,
      frameTime: 0,
      averageFps: 0,
      minFps: 0,
      maxFps: 0,
      sampleCount: 0,
    };
  }
  
  const currentFrameTime = latestSample.frameTime;
  const currentFps = currentFrameTime > 0 ? 1000 / currentFrameTime : 0;

  // Calculate average frame time
  const totalFrameTime = monitor.samples.reduce((sum, sample) => sum + sample.frameTime, 0);
  const averageFrameTime = totalFrameTime / monitor.samples.length;
  const averageFps = averageFrameTime > 0 ? 1000 / averageFrameTime : 0;

  // Calculate min and max FPS
  const fpsSamples = monitor.samples
    .filter(sample => sample.frameTime > 0)
    .map(sample => 1000 / sample.frameTime);

  const minFps = fpsSamples.length > 0 ? Math.min(...fpsSamples) : 0;
  const maxFps = fpsSamples.length > 0 ? Math.max(...fpsSamples) : 0;

  return {
    fps: Math.round(currentFps * 10) / 10, // Round to 1 decimal place
    frameTime: Math.round(currentFrameTime * 10) / 10,
    averageFps: Math.round(averageFps * 10) / 10,
    minFps: Math.round(minFps * 10) / 10,
    maxFps: Math.round(maxFps * 10) / 10,
    sampleCount: monitor.samples.length,
  };
}

// Pure function to format performance metrics for display
export function formatPerformanceMetrics(metrics: PerformanceMetrics): {
  readonly fps: string;
  readonly frameTime: string;
  readonly averageFps: string;
  readonly minMaxFps: string;
} {
  return {
    fps: `${metrics.fps} FPS`,
    frameTime: `${metrics.frameTime}ms`,
    averageFps: `Avg: ${metrics.averageFps} FPS`,
    minMaxFps: `Min: ${metrics.minFps} / Max: ${metrics.maxFps} FPS`,
  };
}

// Pure function to check if performance is below threshold
export function isPerformanceBelowThreshold(metrics: PerformanceMetrics, threshold: number): boolean {
  return metrics.fps < threshold;
}

// Pure function to get performance status
export function getPerformanceStatus(metrics: PerformanceMetrics): "excellent" | "good" | "fair" | "poor" {
  if (metrics.fps >= 55) {
    return "excellent";
  } else if (metrics.fps >= 45) {
    return "good";
  } else if (metrics.fps >= 30) {
    return "fair";
  } else {
    return "poor";
  }
}

// Pure function to calculate performance statistics
export function calculatePerformanceStatistics(monitor: PerformanceMonitor): {
  readonly frameTimeStdDev: number;
  readonly fpsStability: number;
  readonly droppedFrames: number;
} {
  if (monitor.samples.length < 2) {
    return {
      frameTimeStdDev: 0,
      fpsStability: 0,
      droppedFrames: 0,
    };
  }

  // Calculate frame time standard deviation
  const frameTimes = monitor.samples.map(sample => sample.frameTime);
  const averageFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
  
  const variance = frameTimes.reduce((sum, time) => {
    const diff = time - averageFrameTime;
    return sum + (diff * diff);
  }, 0) / frameTimes.length;
  
  const frameTimeStdDev = Math.sqrt(variance);

  // Calculate FPS stability (inverse of coefficient of variation)
  const fpsSamples = monitor.samples
    .filter(sample => sample.frameTime > 0)
    .map(sample => 1000 / sample.frameTime);

  let fpsStability = 0;
  if (fpsSamples.length > 0) {
    const averageFps = fpsSamples.reduce((sum, fps) => sum + fps, 0) / fpsSamples.length;
    const fpsVariance = fpsSamples.reduce((sum, fps) => {
      const diff = fps - averageFps;
      return sum + (diff * diff);
    }, 0) / fpsSamples.length;
    
    const fpsStdDev = Math.sqrt(fpsVariance);
    const coefficientOfVariation = averageFps > 0 ? fpsStdDev / averageFps : 1;
    fpsStability = Math.max(0, 1 - coefficientOfVariation);
  }

  // Count dropped frames (frames that took significantly longer than expected)
  const expectedFrameTime = 16.67; // 60fps target
  const droppedFrameThreshold = expectedFrameTime * 2; // Double the expected time
  const droppedFrames = frameTimes.filter(time => time > droppedFrameThreshold).length;

  return {
    frameTimeStdDev: Math.round(frameTimeStdDev * 100) / 100,
    fpsStability: Math.round(fpsStability * 100) / 100,
    droppedFrames,
  };
}

// Pure function to reset performance monitor
export function resetPerformanceMonitor(monitor: PerformanceMonitor): PerformanceMonitor {
  return {
    ...monitor,
    samples: [],
    lastUpdateTime: performance.now(),
  };
}

// Pure function to get recent performance trend
export function getPerformanceTrend(monitor: PerformanceMonitor, sampleWindow: number = 10): "improving" | "stable" | "declining" | "insufficient_data" {
  if (monitor.samples.length < sampleWindow * 2) {
    return "insufficient_data";
  }

  const recentSamples = monitor.samples.slice(-sampleWindow);
  const olderSamples = monitor.samples.slice(-(sampleWindow * 2), -sampleWindow);

  const recentAvgFps = recentSamples
    .filter(sample => sample.frameTime > 0)
    .map(sample => 1000 / sample.frameTime)
    .reduce((sum, fps) => sum + fps, 0) / recentSamples.length;

  const olderAvgFps = olderSamples
    .filter(sample => sample.frameTime > 0)
    .map(sample => 1000 / sample.frameTime)
    .reduce((sum, fps) => sum + fps, 0) / olderSamples.length;

  const difference = recentAvgFps - olderAvgFps;
  const threshold = 2; // 2 FPS difference threshold

  if (difference > threshold) {
    return "improving";
  } else if (difference < -threshold) {
    return "declining";
  } else {
    return "stable";
  }
}