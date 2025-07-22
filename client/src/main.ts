import { initializeWebGPU, checkWebGPUSupport } from "./module/webgpu.js";

type WebGPUResources = {
  readonly device: GPUDevice;
  readonly context: GPUCanvasContext;
  readonly format: GPUTextureFormat;
};
import { loadShader, createPipelines } from "./module/shaders.js";
import { createBufferSet, type SimulationParams } from "./module/buffers.js";

type PipelineSet = {
  readonly compute: GPUComputePipeline;
  readonly render: GPURenderPipeline;
};

async function main(): Promise<void> {
  // Get canvas element
  const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
  if (!canvas) {
    console.error("Canvas element not found");
    return;
  }
  
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
  
  // Load shaders
  console.log("Loading shaders...");
  let shaderCode;
  try {
    shaderCode = {
      compute: await loadShader("./shader/compute.wgsl"),
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
  
  // Create simulation parameters
  const simulationParams: SimulationParams = {
    agentCount: 100,
    separationRadius: 25.0,
    alignmentRadius: 50.0,
    cohesionRadius: 50.0,
    separationForce: 1.5,
    alignmentForce: 1.0,
    cohesionForce: 1.0,
    maxSpeed: 2.0,
    worldSize: [canvas.width, canvas.height],
    neighborRadius: 50.0,
  };
  
  // Create all buffers using the buffer module
  const bufferSet = createBufferSet(webgpuResult.device, simulationParams);
  
  // Create uniform buffer for render pipeline (view projection matrix)
  const renderUniformData = new Float32Array([
    // viewProjection matrix (identity for now)
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
    // worldSize
    canvas.width, canvas.height,
  ]);
  
  const renderUniformBuffer = webgpuResult.device.createBuffer({
    size: renderUniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  webgpuResult.device.queue.writeBuffer(renderUniformBuffer, 0, renderUniformData);
  
  // Create compute bind groups for double buffering
  const computeBindGroups = [
    webgpuResult.device.createBindGroup({
      layout: pipelines.compute.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufferSet.agentBuffers[0] } },
        { binding: 1, resource: { buffer: bufferSet.agentBuffers[1] } },
        { binding: 2, resource: { buffer: bufferSet.uniformBuffer } },
      ],
    }),
    webgpuResult.device.createBindGroup({
      layout: pipelines.compute.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufferSet.agentBuffers[1] } },
        { binding: 1, resource: { buffer: bufferSet.agentBuffers[0] } },
        { binding: 2, resource: { buffer: bufferSet.uniformBuffer } },
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
  
  function startSimulation(): void {
    // Type assertion is safe here because we already checked that webgpuResult is not an Error
    const resources = webgpuResult as WebGPUResources;
    
    function frame(): void {
      const commandEncoder = resources.device.createCommandEncoder();
      
      // Compute pass
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(pipelines.compute);
      computePass.setBindGroup(0, computeBindGroups[currentBuffer]);
      const workgroupCount = Math.ceil(simulationParams.agentCount / 64);
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
            clearValue: { r: 0.0, g: 0.0, b: 0.2, a: 1.0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      };
      
      const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
      renderPass.setPipeline(pipelines.render);
      renderPass.setBindGroup(0, renderBindGroups[currentBuffer]);
      renderPass.draw(6, simulationParams.agentCount); // 6 vertices per quad, one instance per agent
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