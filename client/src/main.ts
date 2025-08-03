import { initializeWebGPU, checkWebGPUSupport } from "./module/webgpu.js";

type WebGPUResources = {
  readonly device: GPUDevice;
  readonly context: GPUCanvasContext;
  readonly format: GPUTextureFormat;
};
import { loadShader, createPipelines } from "./module/shaders.js";
import { createBufferSet, updateUniforms } from "./module/buffers.js";
import { 
  createInitialFPSState, 
  updateFrameTime, 
  calculateRollingAverage, 
  shouldUpdateDisplay, 
  updateFPSDisplay as updateFPSState,
  toggleVisibility,
  type FPSState,
  type FPSConfig 
} from "./module/fps.js";
import { 
  createFPSDisplay, 
  updateFPSDisplay, 
  setFPSDisplayVisibility, 
  type FPSDisplayElement 
} from "./module/fps-display.js";
import { createKeyboardListener, type KeyboardListener } from "./module/keyboard.js";

type PipelineSet = {
  readonly compute: GPUComputePipeline;
  readonly gridPopulate: GPUComputePipeline;
  readonly render: GPURenderPipeline;
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
    // Display error on canvas
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ff0000";
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.fillText(errorMessage, canvas.width / 2, canvas.height / 2);
    }
    return;
  }
  
  // Initialize WebGPU
  const webgpuResult = await initializeWebGPU(canvas);
  
  if (webgpuResult instanceof Error) {
    console.error("WebGPU initialization failed:", webgpuResult.message);
    // Display error on canvas
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ff0000";
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.fillText("WebGPU initialization failed", canvas.width / 2, canvas.height / 2);
      ctx.fillText(webgpuResult.message, canvas.width / 2, canvas.height / 2 + 30);
    }
    return;
  }
  
  console.log("WebGPU initialized successfully!");
  console.log("Device:", webgpuResult.device);
  console.log("Format:", webgpuResult.format);
  
  // Initialize FPS counter
  const fpsConfig: FPSConfig = {
    bufferSize: 60,
    updateInterval: 1000,
  };
  
  let fpsState: FPSState = createInitialFPSState(fpsConfig);
  
  const fpsDisplayResult = createFPSDisplay();
  if (fpsDisplayResult instanceof Error) {
    console.error("Failed to create FPS display:", fpsDisplayResult.message);
    return;
  }
  
  const fpsDisplay: FPSDisplayElement = fpsDisplayResult;
  
  // Set initial visibility based on FPS state
  setFPSDisplayVisibility(fpsDisplay, fpsState.isVisible);
  
  // Set up keyboard listener for 'F' key to toggle FPS display
  const keyboardListenerResult = createKeyboardListener('f', () => {
    fpsState = toggleVisibility(fpsState);
    setFPSDisplayVisibility(fpsDisplay, fpsState.isVisible);
  });
  
  if (keyboardListenerResult instanceof Error) {
    console.error("Failed to create keyboard listener:", keyboardListenerResult.message);
    return;
  }
  
  const keyboardListener: KeyboardListener = keyboardListenerResult;
  // Note: keyboardListener is maintained for potential cleanup in future iterations
  void keyboardListener; // Suppress unused variable warning
  
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
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ff0000";
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Failed to load shaders", canvas.width / 2, canvas.height / 2);
      ctx.fillText(error instanceof Error ? error.message : String(error), canvas.width / 2, canvas.height / 2 + 30);
    }
    return;
  }
  
  // Create pipelines
  console.log("Creating pipelines...");
  let pipelines: PipelineSet;
  try {
    pipelines = createPipelines(webgpuResult.device, shaderCode);
    console.log("Pipelines created successfully!");
  } catch (error) {
    console.error("Failed to create pipelines:", error);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ff0000";
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Shader compilation failed", canvas.width / 2, canvas.height / 2);
      ctx.fillText(error instanceof Error ? error.message : String(error), canvas.width / 2, canvas.height / 2 + 30);
    }
    return;
  }
  
  // Create simulation parameters (after canvas is resized)
  const simulationParamsInput = {
    agentCount: 10_000,
    separationRadius: 20.0,    // Closer separation for tighter flocks
    alignmentRadius: 40.0,     // Medium range for alignment
    cohesionRadius: 40.0,      // Medium range for cohesion
    separationForce: 1.5,
    alignmentForce: 1.0,
    cohesionForce: 1.0,
    maxSpeed: 2.0,
    worldSize: [canvas.width, canvas.height] as const,
    neighborRadius: 50.0,
    edgeAvoidanceDistance: 50.0,
    edgeAvoidanceForce: 2.0,
  };
  
  // Create all buffers using the buffer module
  const bufferSet = createBufferSet(webgpuResult.device, simulationParamsInput);
  
  // Create uniform buffer for render pipeline (view projection matrix)
  // Must be at least 80 bytes to match WGSL Uniforms struct with padding
  const renderUniformData = new Float32Array(20); // 80 bytes total
  // viewProjection matrix (identity for now)
  renderUniformData.set([
    1, 0, 0, 0,  // row 0
    0, 1, 0, 0,  // row 1
    0, 0, 1, 0,  // row 2
    0, 0, 0, 1,  // row 3
  ], 0);
  // worldSize at offset 16 (64 bytes / 4 = 16 floats)
  renderUniformData[16] = canvas.width;
  renderUniformData[17] = canvas.height;
  // Remaining elements are zero-padded
  
  const renderUniformBuffer = webgpuResult.device.createBuffer({
    size: renderUniformData.byteLength, // 80 bytes
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  webgpuResult.device.queue.writeBuffer(renderUniformBuffer, 0, renderUniformData);
  
  // Create compute bind groups for double buffering (now includes grid buffers)
  const computeBindGroups = [
    webgpuResult.device.createBindGroup({
      layout: pipelines.compute.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufferSet.agentBuffers[0] } },
        { binding: 1, resource: { buffer: bufferSet.agentBuffers[1] } },
        { binding: 2, resource: { buffer: bufferSet.uniformBuffer } },
        { binding: 3, resource: { buffer: bufferSet.gridBuffer } },
        { binding: 4, resource: { buffer: bufferSet.gridIndicesBuffer } },
      ],
    }),
    webgpuResult.device.createBindGroup({
      layout: pipelines.compute.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufferSet.agentBuffers[1] } },
        { binding: 1, resource: { buffer: bufferSet.agentBuffers[0] } },
        { binding: 2, resource: { buffer: bufferSet.uniformBuffer } },
        { binding: 3, resource: { buffer: bufferSet.gridBuffer } },
        { binding: 4, resource: { buffer: bufferSet.gridIndicesBuffer } },
      ],
    }),
  ];

  // Create grid populate bind groups for double buffering
  const gridPopulateBindGroups = [
    webgpuResult.device.createBindGroup({
      layout: pipelines.gridPopulate.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufferSet.agentBuffers[0] } },
        { binding: 1, resource: { buffer: bufferSet.gridBuffer } },
        { binding: 2, resource: { buffer: bufferSet.gridIndicesBuffer } },
        { binding: 3, resource: { buffer: bufferSet.uniformBuffer } },
      ],
    }),
    webgpuResult.device.createBindGroup({
      layout: pipelines.gridPopulate.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufferSet.agentBuffers[1] } },
        { binding: 1, resource: { buffer: bufferSet.gridBuffer } },
        { binding: 2, resource: { buffer: bufferSet.gridIndicesBuffer } },
        { binding: 3, resource: { buffer: bufferSet.uniformBuffer } },
      ],
    }),
  ];
  
  // Create render bind groups for both buffers
  const renderBindGroups = [
    webgpuResult.device.createBindGroup({
      layout: pipelines.render.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufferSet.agentBuffers[0] } },
        { binding: 1, resource: { buffer: renderUniformBuffer } },
      ],
    }),
    webgpuResult.device.createBindGroup({
      layout: pipelines.render.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufferSet.agentBuffers[1] } },
        { binding: 1, resource: { buffer: renderUniformBuffer } },
      ],
    }),
  ];
  
  // Start the simulation with render loop
  let currentBuffer = 0;
  let lastTime = performance.now();
  
  function startSimulation(): void {
    // Type assertion is safe here because we already checked that webgpuResult is not an Error
    const resources = webgpuResult as WebGPUResources;
    
    function frame(currentTime: number): void {
      // Update FPS tracking
      fpsState = updateFrameTime(fpsState, currentTime);
      
      // Update FPS display if enough time has passed
      if (shouldUpdateDisplay(fpsState, currentTime, fpsConfig)) {
        const newFPS = calculateRollingAverage(fpsState.frameTimes);
        fpsState = updateFPSState(fpsState, currentTime, newFPS);
        if (fpsState.isVisible) {
          updateFPSDisplay(fpsDisplay, fpsState.currentFPS);
        }
      }
      
      const deltaTimeMs = currentTime - lastTime;
      lastTime = currentTime;
      
      // Scale deltaTime to maintain reasonable movement speed while being frame-rate independent
      // Target 60fps (16.67ms) as baseline, so at 60fps deltaTime = 1.0
      const deltaTime = deltaTimeMs / 16.67;
      
      // Update uniform buffer with scaled deltaTime
      updateUniforms(resources.device, bufferSet.uniformBuffer, bufferSet.params, deltaTime);
      
      const commandEncoder = resources.device.createCommandEncoder();
      
      // Clear grid buffers - clear the indices buffer to reset agent counts per cell
      const cellCount = bufferSet.params.gridWidth * bufferSet.params.gridHeight;
      const emptyIndices = new Uint32Array(cellCount);
      emptyIndices.fill(0);
      resources.device.queue.writeBuffer(bufferSet.gridIndicesBuffer, 0, emptyIndices);
      
      // Grid populate pass - assign agents to grid cells
      const gridPopulatePass = commandEncoder.beginComputePass();
      gridPopulatePass.setPipeline(pipelines.gridPopulate);
      gridPopulatePass.setBindGroup(0, gridPopulateBindGroups[currentBuffer]);
      const gridWorkgroupCount = Math.ceil(bufferSet.params.agentCount / 64);
      gridPopulatePass.dispatchWorkgroups(gridWorkgroupCount);
      gridPopulatePass.end();
      
      // Compute pass
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(pipelines.compute);
      computePass.setBindGroup(0, computeBindGroups[currentBuffer]);
      const workgroupCount = Math.ceil(bufferSet.params.agentCount / 64);
      computePass.dispatchWorkgroups(workgroupCount);
      computePass.end();
      
      // Swap buffers for next frame
      currentBuffer = 1 - currentBuffer;
      
      // Render pass
      const textureView = resources.context.getCurrentTexture().createView();
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
      renderPass.setBindGroup(0, renderBindGroups[currentBuffer]);
      renderPass.draw(6, bufferSet.params.agentCount); // 6 vertices per quad, one instance per agent
      renderPass.end();
      
      resources.device.queue.submit([commandEncoder.finish()]);
      
      requestAnimationFrame(frame);
    }
    
    // Start the render loop
    requestAnimationFrame(frame);
  }
  
  startSimulation();
  console.log("Flocking simulation started!");
}

// Start the application
main();