// UI Control Module for Flock Simulation
// Following strict TypeScript functional programming patterns from CLAUDE.md

import type {
  UISliderConfig,
  UIButtonConfig,
  UIDisplayConfig,
  UIControlPanel,
  CreateSliderResult,
  CreateButtonResult,
  CreateDisplayResult,
  CreateControlPanelResult,
  SliderChangeHandler,
  ButtonClickHandler,
} from "./types.js";

// Pure function to create a slider element
export function createSlider(config: UISliderConfig, changeHandler: SliderChangeHandler): CreateSliderResult {
  let element: HTMLInputElement;
  try {
    element = document.createElement("input");
  } catch (e) {
    return new Error("Failed to create slider element");
  }

  element.type = "range";
  element.id = config.id;
  element.className = "ui-slider";
  element.min = config.min.toString();
  element.max = config.max.toString();
  element.step = config.step.toString();
  element.value = config.value.toString();

  // Add event listener with error handling
  const handleChange = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    const numericValue = parseFloat(target.value);
    
    if (isNaN(numericValue)) {
      console.error(`Invalid slider value: ${target.value}`);
      return;
    }

    const result = changeHandler(config.id, numericValue);
    if (result instanceof Error) {
      console.error(`Parameter update failed: ${result.message}`);
      // Reset to previous value
      target.value = config.value.toString();
    }
  };

  element.addEventListener("input", handleChange);

  return element;
}

// Pure function to create a button element
export function createButton(config: UIButtonConfig, clickHandler: ButtonClickHandler): CreateButtonResult {
  let element: HTMLButtonElement;
  try {
    element = document.createElement("button");
  } catch (e) {
    return new Error("Failed to create button element");
  }

  element.id = config.id;
  element.className = config.className;
  element.textContent = config.label;
  element.type = "button";

  element.addEventListener("click", clickHandler);

  return element;
}

// Pure function to create a display element
export function createDisplay(config: UIDisplayConfig): CreateDisplayResult {
  let element: HTMLDivElement;
  try {
    element = document.createElement("div");
  } catch (e) {
    return new Error("Failed to create display element");
  }

  element.id = config.id;
  element.className = config.className;

  return element;
}

// Pure function to create a label for a slider
function createSliderLabel(config: UISliderConfig): HTMLLabelElement | Error {
  let label: HTMLLabelElement;
  try {
    label = document.createElement("label");
  } catch (e) {
    return new Error("Failed to create label element");
  }

  label.htmlFor = config.id;
  label.className = "ui-label";
  label.textContent = `${config.label}: ${config.value}${config.unit}`;

  return label;
}

// Pure function to create a slider group (label + slider + value display)
function createSliderGroup(config: UISliderConfig, changeHandler: SliderChangeHandler): HTMLDivElement | Error {
  let container: HTMLDivElement;
  try {
    container = document.createElement("div");
  } catch (e) {
    return new Error("Failed to create slider group container");
  }

  container.className = "slider-group";

  const label = createSliderLabel(config);
  if (label instanceof Error) {
    return label;
  }

  const slider = createSlider(config, changeHandler);
  if (slider instanceof Error) {
    return slider;
  }

  let valueDisplay: HTMLSpanElement;
  try {
    valueDisplay = document.createElement("span");
  } catch (e) {
    return new Error("Failed to create value display element");
  }

  valueDisplay.className = "slider-value";
  valueDisplay.textContent = `${config.value}${config.unit}`;

  // Update value display when slider changes
  const updateDisplay = (): void => {
    const currentValue = parseFloat(slider.value);
    if (!isNaN(currentValue)) {
      valueDisplay.textContent = `${currentValue}${config.unit}`;
      label.textContent = `${config.label}: ${currentValue}${config.unit}`;
    }
  };

  slider.addEventListener("input", updateDisplay);

  container.appendChild(label);
  container.appendChild(slider);
  container.appendChild(valueDisplay);

  return container;
}

// Pure function to create the main control panel
export function createControlPanel(
  sliderConfigs: readonly UISliderConfig[],
  buttonConfigs: readonly UIButtonConfig[],
  displayConfigs: readonly UIDisplayConfig[],
  sliderChangeHandler: SliderChangeHandler,
  buttonClickHandlers: ReadonlyMap<string, ButtonClickHandler>
): CreateControlPanelResult {
  let container: HTMLDivElement;
  try {
    container = document.createElement("div");
  } catch (e) {
    return new Error("Failed to create control panel container");
  }

  container.id = "control-panel";
  container.className = "control-panel";

  const sliders = new Map<string, HTMLInputElement>();
  const buttons = new Map<string, HTMLButtonElement>();
  const displays = new Map<string, HTMLElement>();

  // Create slider groups
  for (const config of sliderConfigs) {
    const sliderGroup = createSliderGroup(config, sliderChangeHandler);
    if (sliderGroup instanceof Error) {
      return sliderGroup;
    }

    container.appendChild(sliderGroup);

    // Find the slider element within the group and add to map
    const sliderElement = sliderGroup.querySelector(`#${config.id}`) as HTMLInputElement;
    if (sliderElement) {
      sliders.set(config.id, sliderElement);
    }
  }

  // Create buttons
  for (const config of buttonConfigs) {
    const clickHandler = buttonClickHandlers.get(config.id);
    if (!clickHandler) {
      return new Error(`No click handler found for button: ${config.id}`);
    }

    const button = createButton(config, clickHandler);
    if (button instanceof Error) {
      return button;
    }

    container.appendChild(button);
    buttons.set(config.id, button);
  }

  // Create displays
  for (const config of displayConfigs) {
    const display = createDisplay(config);
    if (display instanceof Error) {
      return display;
    }

    container.appendChild(display);
    displays.set(config.id, display);
  }

  return {
    container,
    sliders,
    buttons,
    displays,
  };
}

// Pure function to update a display element's content
export function updateDisplay(element: HTMLElement, content: string): void {
  element.textContent = content;
}

// Pure function to show/hide the control panel
export function setControlPanelVisibility(panel: UIControlPanel, visible: boolean): void {
  panel.container.style.display = visible ? "block" : "none";
}

// Pure function to get current slider values
export function getSliderValues(panel: UIControlPanel): ReadonlyMap<string, number> {
  const values = new Map<string, number>();
  
  for (const [id, slider] of panel.sliders) {
    const numericValue = parseFloat(slider.value);
    if (!isNaN(numericValue)) {
      values.set(id, numericValue);
    }
  }

  return values;
}

// Pure function to set slider value programmatically
export function setSliderValue(slider: HTMLInputElement, value: number): void {
  slider.value = value.toString();
  
  // Trigger input event to update displays
  const event = new Event("input");
  slider.dispatchEvent(event);
}

// Pure function to create default slider configurations for flocking parameters
export function createDefaultSliderConfigs(): readonly UISliderConfig[] {
  return [
    {
      id: "agentCount",
      label: "Agent Count",
      min: 10,
      max: 1000,
      step: 10,
      value: 100,
      unit: "",
    },
    {
      id: "separationRadius",
      label: "Separation Radius",
      min: 5,
      max: 100,
      step: 1,
      value: 20,
      unit: "px",
    },
    {
      id: "alignmentRadius",
      label: "Alignment Radius",
      min: 10,
      max: 150,
      step: 1,
      value: 40,
      unit: "px",
    },
    {
      id: "cohesionRadius",
      label: "Cohesion Radius",
      min: 10,
      max: 150,
      step: 1,
      value: 40,
      unit: "px",
    },
    {
      id: "separationForce",
      label: "Separation Force",
      min: 0.1,
      max: 5.0,
      step: 0.1,
      value: 1.5,
      unit: "",
    },
    {
      id: "alignmentForce",
      label: "Alignment Force",
      min: 0.1,
      max: 5.0,
      step: 0.1,
      value: 1.0,
      unit: "",
    },
    {
      id: "cohesionForce",
      label: "Cohesion Force",
      min: 0.1,
      max: 5.0,
      step: 0.1,
      value: 1.0,
      unit: "",
    },
    {
      id: "maxSpeed",
      label: "Max Speed",
      min: 0.5,
      max: 10.0,
      step: 0.1,
      value: 2.0,
      unit: "px/frame",
    },
  ];
}

// Pure function to create default button configurations
export function createDefaultButtonConfigs(): readonly UIButtonConfig[] {
  return [
    {
      id: "togglePanel",
      label: "Toggle Controls",
      className: "ui-button toggle-button",
    },
    {
      id: "resetParams",
      label: "Reset Parameters",
      className: "ui-button reset-button",
    },
  ];
}

// Pure function to create default display configurations
export function createDefaultDisplayConfigs(): readonly UIDisplayConfig[] {
  return [
    {
      id: "fpsDisplay",
      label: "FPS",
      className: "performance-display fps-display",
    },
    {
      id: "frameTimeDisplay",
      label: "Frame Time",
      className: "performance-display frame-time-display",
    },
    {
      id: "agentCountDisplay",
      label: "Agent Count",
      className: "info-display agent-count-display",
    },
  ];
}