import { initializeWebGPU, checkWebGPUSupport } from "./module/webgpu.js";
import { loadShader, createPipelines } from "./module/shaders.js";
import {
  createBufferSet,
  updateUniforms,
  updateSimulationParams,
  createBufferSetWithNewAgentCount,
  getDefaultSimulationParams,
} from "./module/buffers.js";
import {
  createControlPanel,
  createDefaultSliderConfigs,
  createDefaultButtonConfigs,
  createDefaultDisplayConfigs,
  updateDisplay,
  setControlPanelVisibility,
  setSliderValue,
} from "./module/ui.js";
import {
  createPerformanceMonitor,
  addPerformanceSample,
  calculatePerformanceMetrics,
  formatPerformanceMetrics,
  getPerformanceStatus,
} from "./module/performance.js";
import type {
  UIControlPanel,
  PerformanceMonitor,
  SliderChangeHandler,
  ButtonClickHandler,
  SimulationParams,
  BufferSet,
} from "./module/types.js";

type WebGPUResources = {
  readonly device: GPUDevice;
  readonly context: GPUCanvasContext;
  readonly format: GPUTextureFormat;
};

type PipelineSet = {
  readonly compute: GPUComputePipeline;
  readonly gridPopulate: GPUComputePipeline;
  readonly render: GPURenderPipeline;
};

type SimulationState = {
  bufferSet: BufferSet;
  currentBuffer: number;
  performanceMonitor: PerformanceMonitor;
  lastTime: number;
  isRunning: boolean;
};

async function main(): Promise<void> {
  // Get canvas element
  const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
  if (!canvas) {
    console.error("Canvas element not found");
    return;
  }
  
  // Resize canvas to match display size
  const resizeCanvas = (): void => {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
  };
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Check WebGPU support first
  if (!checkWebGPUSupport()) {
    const errorMessage = "WebGPU is only supported in Chrome 113+. Please use Chrome browser.";
    console.error(errorMessage);
    displayError(canvas, errorMessage);
    return;
  }
  
  // Initialize WebGPU
  const webgpuResult = await initializeWebGPU(canvas);
  
  if (webgpuResult instanceof Error) {
    console.error("WebGPU initialization failed:", webgpuResult.message);
    displayError(canvas, "WebGPU initialization failed", webgpuResult.message);
    return;
  }
  
  // Type assertion is safe here because we already checked that webgpuResult is not an Error
  const webgpuResources = webgpuResult as WebGPUResources;
  console.log("WebGPU initialized successfully!");
  
  // Load shaders
  console.log("Loading shaders...");
  let shaderCode;
  try {
    shaderCode = {
      compute: await loadShader("./shader/compute.wgsl"),
      gridPopulate: await loadShader("./shader/grid_populate.wgsl"),
      vertex: await loadShader("./shader/vertex.wgsl"),
      fragment: await loadShader("./shader/fragment.wgsl"),
    };
    console.log("Shaders loaded successfully!");
  } catch (error) {
    console.error("Failed to load shaders:", error);
    displayError(canvas, "Failed to load shaders", 
      error instanceof Error ? error.message : String(error));
    return;
  }
  
  // Create pipelines
  console.log("Creating pipelines...");
  let pipelines: PipelineSet;
  try {
    pipelines = createPipelines(webgpuResources.device, shaderCode);
    console.log("Pipelines created successfully!");
  } catch (error) {
    console.error("Failed to create pipelines:", error);
    displayError(canvas, "Shader compilation failed",
      error instanceof Error ? error.message : String(error));
    return;
  }
  
  // Initialize simulation state
  const defaultParams = getDefaultSimulationParams([canvas.width, canvas.height]);
  let simulationState: SimulationState = {
    bufferSet: createBufferSet(webgpuResources.device, {
      agentCount: defaultParams.agentCount,
      separationRadius: defaultParams.separationRadius,
      alignmentRadius: defaultParams.alignmentRadius,
      cohesionRadius: defaultParams.cohesionRadius,
      separationForce: defaultParams.separationForce,
      alignmentForce: defaultParams.alignmentForce,
      cohesionForce: defaultParams.cohesionForce,
      maxSpeed: defaultParams.maxSpeed,
      worldSize: defaultParams.worldSize,
      neighborRadius: defaultParams.neighborRadius,
    }),
    currentBuffer: 0,
    performanceMonitor: createPerformanceMonitor(),
    lastTime: performance.now(),
    isRunning: false,
  };
  
  // Create render uniform buffer
  const renderUniformData = new Float32Array(20);
  renderUniformData.set([
    1, 0, 0, 0,  // identity matrix row 0
    0, 1, 0, 0,  // identity matrix row 1
    0, 0, 1, 0,  // identity matrix row 2
    0, 0, 0, 1,  // identity matrix row 3
  ], 0);
  renderUniformData[16] = canvas.width;
  renderUniformData[17] = canvas.height;
  
  const renderUniformBuffer = webgpuResources.device.createBuffer({
    size: renderUniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  webgpuResources.device.queue.writeBuffer(renderUniformBuffer, 0, renderUniformData);
  
  // Create bind groups
  let bindGroups = createBindGroups(webgpuResources.device, pipelines, simulationState.bufferSet, renderUniformBuffer);
  
  // Create UI components
  const sliderConfigs = createDefaultSliderConfigs();
  const buttonConfigs = createDefaultButtonConfigs();
  const displayConfigs = createDefaultDisplayConfigs();
  
  // Create parameter update handler
  const sliderChangeHandler: SliderChangeHandler = (parameterId: string, value: number) => {
    const updates = new Map([[parameterId, value]]);
    const result = updateSimulationParams(simulationState.bufferSet.params, updates);
    
    if (result instanceof Error) {
      console.error(`Parameter update failed: ${result.message}`);
      return result;
    }
    
    // Handle agent count changes specially
    if (parameterId === "agentCount") {
      const newBufferSetResult = createBufferSetWithNewAgentCount(
        webgpuResources.device,
        simulationState.bufferSet.params,
        value
      );
      
      if (newBufferSetResult instanceof Error) {
        console.error(`Agent count update failed: ${newBufferSetResult.message}`);
        return newBufferSetResult;
      }
      
      // Update simulation state with new buffer set
      simulationState = {
        ...simulationState,
        bufferSet: newBufferSetResult,
        currentBuffer: 0,
      };
      
      // Recreate bind groups with new buffers
      bindGroups = createBindGroups(webgpuResources.device, pipelines, simulationState.bufferSet, renderUniformBuffer);
      
      return {
        success: true,
        updatedParams: simulationState.bufferSet.params,
      };
    }
    
    // Update buffer set parameters for non-agent-count changes
    simulationState = {
      ...simulationState,
      bufferSet: {
        ...simulationState.bufferSet,
        params: result,
      },
    };
    
    return {
      success: true,
      updatedParams: result,
    };
  };
  
  // Create button click handlers
  let controlPanelVisible = true;
  const buttonClickHandlers = new Map<string, ButtonClickHandler>([
    ["togglePanel", () => {
      controlPanelVisible = !controlPanelVisible;
      if (controlPanel) {
        setControlPanelVisibility(controlPanel, controlPanelVisible);
      }
    }],
    ["resetParams", () => {
      const resetParams = getDefaultSimulationParams([canvas.width, canvas.height]);
      
      // Reset all sliders to default values
      if (controlPanel) {
        for (const [sliderId, slider] of controlPanel.sliders) {
          const config = sliderConfigs.find(c => c.id === sliderId);
          if (config) {
            setSliderValue(slider, config.value);
          }
        }
      }
      
      // Reset simulation state
      simulationState = {
        ...simulationState,
        bufferSet: createBufferSet(webgpuResources.device, {
          agentCount: resetParams.agentCount,
          separationRadius: resetParams.separationRadius,
          alignmentRadius: resetParams.alignmentRadius,
          cohesionRadius: resetParams.cohesionRadius,
          separationForce: resetParams.separationForce,
          alignmentForce: resetParams.alignmentForce,
          cohesionForce: resetParams.cohesionForce,
          maxSpeed: resetParams.maxSpeed,
          worldSize: resetParams.worldSize,
          neighborRadius: resetParams.neighborRadius,
        }),
        currentBuffer: 0,
      };
      
      bindGroups = createBindGroups(webgpuResources.device, pipelines, simulationState.bufferSet, renderUniformBuffer);
    }],
  ]);
  
  // Create control panel
  const controlPanelResult = createControlPanel(
    sliderConfigs,
    buttonConfigs,
    displayConfigs,
    sliderChangeHandler,
    buttonClickHandlers
  );
  
  if (controlPanelResult instanceof Error) {
    console.error("Failed to create control panel:", controlPanelResult.message);
    return;
  }
  
  const controlPanel: UIControlPanel = controlPanelResult;
  
  // Add control panel to DOM
  document.body.appendChild(controlPanel.container);
  
  // Create toggle button that stays visible
  const toggleButton = document.createElement("button");
  toggleButton.className = "toggle-panel-button";
  toggleButton.textContent = "Controls";
  toggleButton.addEventListener("click", () => {
    controlPanelVisible = !controlPanelVisible;
    setControlPanelVisibility(controlPanel, controlPanelVisible);
    toggleButton.style.display = controlPanelVisible ? "none" : "block";
  });
  document.body.appendChild(toggleButton);
  
  // Initially hide the toggle button since panel is visible
  toggleButton.style.display = "none";
  
  // Start the simulation
  simulationState.isRunning = true;
  
  function frame(currentTime: number): void {
    if (!simulationState.isRunning) return;
    
    // Update performance monitoring
    simulationState.performanceMonitor = addPerformanceSample(
      simulationState.performanceMonitor,
      currentTime
    );
    
    const deltaTimeMs = currentTime - simulationState.lastTime;
    simulationState.lastTime = currentTime;
    
    // Scale deltaTime for frame-rate independence
    const deltaTime = deltaTimeMs / 16.67; // Target 60fps baseline
    
    // Update uniform buffer
    updateUniforms(
      webgpuResources.device,
      simulationState.bufferSet.uniformBuffer,
      simulationState.bufferSet.params,
      deltaTime
    );
    
    // Clear grid buffers
    const cellCount = simulationState.bufferSet.params.gridWidth * simulationState.bufferSet.params.gridHeight;
    const emptyIndices = new Uint32Array(cellCount);
    emptyIndices.fill(0);
    webgpuResources.device.queue.writeBuffer(simulationState.bufferSet.gridIndicesBuffer, 0, emptyIndices);
    
    // Execute compute passes
    const commandEncoder = webgpuResources.device.createCommandEncoder();
    
    // Grid populate pass
    const gridPopulatePass = commandEncoder.beginComputePass();
    gridPopulatePass.setPipeline(pipelines.gridPopulate);
    gridPopulatePass.setBindGroup(0, bindGroups.gridPopulate[simulationState.currentBuffer]);
    const gridWorkgroupCount = Math.ceil(simulationState.bufferSet.params.agentCount / 64);
    gridPopulatePass.dispatchWorkgroups(gridWorkgroupCount);
    gridPopulatePass.end();
    
    // Compute pass
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(pipelines.compute);
    computePass.setBindGroup(0, bindGroups.compute[simulationState.currentBuffer]);
    const workgroupCount = Math.ceil(simulationState.bufferSet.params.agentCount / 64);
    computePass.dispatchWorkgroups(workgroupCount);
    computePass.end();
    
    // Swap buffers
    simulationState.currentBuffer = 1 - simulationState.currentBuffer;
    
    // Render pass
    const textureView = webgpuResources.context.getCurrentTexture().createView();
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    };
    
    const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
    renderPass.setPipeline(pipelines.render);
    renderPass.setBindGroup(0, bindGroups.render[simulationState.currentBuffer]);
    renderPass.draw(6, simulationState.bufferSet.params.agentCount);
    renderPass.end();
    
    webgpuResources.device.queue.submit([commandEncoder.finish()]);
    
    // Update UI displays
    updatePerformanceDisplays(controlPanel, simulationState.performanceMonitor);
    updateInfoDisplays(controlPanel, simulationState.bufferSet.params);
    
    requestAnimationFrame(frame);
  }
  
  console.log("Flocking simulation with UI started!");
  requestAnimationFrame(frame);
}

// Helper functions
function displayError(canvas: HTMLCanvasElement, title: string, message?: string): void {
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#ff0000";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(title, canvas.width / 2, canvas.height / 2);
    if (message) {
      ctx.fillText(message, canvas.width / 2, canvas.height / 2 + 30);
    }
  }
}

function createBindGroups(
  device: GPUDevice,
  pipelines: PipelineSet,
  bufferSet: BufferSet,
  renderUniformBuffer: GPUBuffer
) {
  return {
    compute: [
      device.createBindGroup({
        layout: pipelines.compute.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bufferSet.agentBuffers[0] } },
          { binding: 1, resource: { buffer: bufferSet.agentBuffers[1] } },
          { binding: 2, resource: { buffer: bufferSet.uniformBuffer } },
          { binding: 3, resource: { buffer: bufferSet.gridBuffer } },
          { binding: 4, resource: { buffer: bufferSet.gridIndicesBuffer } },
        ],
      }),
      device.createBindGroup({
        layout: pipelines.compute.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bufferSet.agentBuffers[1] } },
          { binding: 1, resource: { buffer: bufferSet.agentBuffers[0] } },
          { binding: 2, resource: { buffer: bufferSet.uniformBuffer } },
          { binding: 3, resource: { buffer: bufferSet.gridBuffer } },
          { binding: 4, resource: { buffer: bufferSet.gridIndicesBuffer } },
        ],
      }),
    ],
    gridPopulate: [
      device.createBindGroup({
        layout: pipelines.gridPopulate.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bufferSet.agentBuffers[0] } },
          { binding: 1, resource: { buffer: bufferSet.gridBuffer } },
          { binding: 2, resource: { buffer: bufferSet.gridIndicesBuffer } },
          { binding: 3, resource: { buffer: bufferSet.uniformBuffer } },
        ],
      }),
      device.createBindGroup({
        layout: pipelines.gridPopulate.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bufferSet.agentBuffers[1] } },
          { binding: 1, resource: { buffer: bufferSet.gridBuffer } },
          { binding: 2, resource: { buffer: bufferSet.gridIndicesBuffer } },
          { binding: 3, resource: { buffer: bufferSet.uniformBuffer } },
        ],
      }),
    ],
    render: [
      device.createBindGroup({
        layout: pipelines.render.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bufferSet.agentBuffers[0] } },
          { binding: 1, resource: { buffer: renderUniformBuffer } },
        ],
      }),
      device.createBindGroup({
        layout: pipelines.render.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bufferSet.agentBuffers[1] } },
          { binding: 1, resource: { buffer: renderUniformBuffer } },
        ],
      }),
    ],
  };
}

function updatePerformanceDisplays(controlPanel: UIControlPanel, monitor: PerformanceMonitor): void {
  const metrics = calculatePerformanceMetrics(monitor);
  const formatted = formatPerformanceMetrics(metrics);
  const status = getPerformanceStatus(metrics);
  
  const fpsDisplay = controlPanel.displays.get("fpsDisplay");
  const frameTimeDisplay = controlPanel.displays.get("frameTimeDisplay");
  
  if (fpsDisplay) {
    updateDisplay(fpsDisplay, formatted.fps);
    fpsDisplay.className = `performance-display fps-display performance-${status}`;
  }
  
  if (frameTimeDisplay) {
    updateDisplay(frameTimeDisplay, formatted.frameTime);
  }
}

function updateInfoDisplays(controlPanel: UIControlPanel, params: SimulationParams): void {
  const agentCountDisplay = controlPanel.displays.get("agentCountDisplay");
  
  if (agentCountDisplay) {
    updateDisplay(agentCountDisplay, `Agents: ${params.agentCount}`);
  }
}

// Start the application
main();