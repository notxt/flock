// UI and Performance Types for Flock Simulation
// Following strict TypeScript functional programming patterns from CLAUDE.md

// Core UI element types
type UISliderConfig = {
  readonly id: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly unit: string;
};

type UIButtonConfig = {
  readonly id: string;
  readonly label: string;
  readonly className: string;
};

type UIDisplayConfig = {
  readonly id: string;
  readonly label: string;
  readonly className: string;
};

// Control panel structure
type UIControlPanel = {
  readonly container: HTMLElement;
  readonly sliders: ReadonlyMap<string, HTMLInputElement>;
  readonly buttons: ReadonlyMap<string, HTMLButtonElement>;
  readonly displays: ReadonlyMap<string, HTMLElement>;
};

// Performance monitoring types
type PerformanceMetrics = {
  readonly fps: number;
  readonly frameTime: number;
  readonly averageFps: number;
  readonly minFps: number;
  readonly maxFps: number;
  readonly sampleCount: number;
};

type PerformanceSample = {
  readonly timestamp: number;
  readonly frameTime: number;
};

type PerformanceMonitor = {
  readonly samples: readonly PerformanceSample[];
  readonly windowSize: number;
  readonly lastUpdateTime: number;
};

// Parameter update types
type ParameterUpdate = {
  readonly parameterId: string;
  readonly value: number;
};

type ParameterUpdateResult = {
  readonly success: boolean;
  readonly updatedParams: SimulationParams;
} | Error;

// Agent count management types
type AgentCountUpdate = {
  readonly newCount: number;
  readonly currentCount: number;
};

type AgentCountUpdateResult = {
  readonly success: boolean;
  readonly newBufferSet: BufferSet;
} | Error;

// UI event handler types
type SliderChangeHandler = (parameterId: string, value: number) => ParameterUpdateResult;
type ButtonClickHandler = () => void;
type AgentCountChangeHandler = (newCount: number) => AgentCountUpdateResult;

// UI state types
type UIState = {
  readonly isVisible: boolean;
  readonly currentParams: SimulationParams;
  readonly performanceMetrics: PerformanceMetrics;
};

// Control creation function types
type CreateSliderResult = HTMLInputElement | Error;
type CreateButtonResult = HTMLButtonElement | Error;
type CreateDisplayResult = HTMLElement | Error;
type CreateControlPanelResult = UIControlPanel | Error;

// Import types from buffers module
import type { SimulationParams, BufferSet } from "./buffers.js";

// Export all types
export type {
  UISliderConfig,
  UIButtonConfig,
  UIDisplayConfig,
  UIControlPanel,
  PerformanceMetrics,
  PerformanceSample,
  PerformanceMonitor,
  ParameterUpdate,
  ParameterUpdateResult,
  AgentCountUpdate,
  AgentCountUpdateResult,
  SliderChangeHandler,
  ButtonClickHandler,
  AgentCountChangeHandler,
  UIState,
  CreateSliderResult,
  CreateButtonResult,
  CreateDisplayResult,
  CreateControlPanelResult,
  SimulationParams,
  BufferSet,
};