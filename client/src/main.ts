import { initializeWebGPU, checkWebGPUSupport } from "./module/webgpu.js";
import { loadShader, createPipelines } from "./module/shaders.js";

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
  let pipelines;
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
  
  // Create test data for basic point rendering
  const agentCount = 100;
  const agentData = new Float32Array(agentCount * 4); // x, y, vx, vy per agent
  
  // Initialize agents with random positions and velocities
  for (let i = 0; i < agentCount; i++) {
    const offset = i * 4;
    agentData[offset + 0] = Math.random() * canvas.width;      // x position
    agentData[offset + 1] = Math.random() * canvas.height;     // y position
    agentData[offset + 2] = (Math.random() - 0.5) * 2;         // x velocity
    agentData[offset + 3] = (Math.random() - 0.5) * 2;         // y velocity
  }
  
  // Create agent buffer
  const agentBuffer = webgpuResult.device.createBuffer({
    size: agentData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  webgpuResult.device.queue.writeBuffer(agentBuffer, 0, agentData);
  
  // Create uniform buffer for render pipeline
  const uniformData = new Float32Array([
    // viewProjection matrix (identity for now)
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
    // worldSize
    canvas.width, canvas.height,
  ]);
  
  const uniformBuffer = webgpuResult.device.createBuffer({
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  webgpuResult.device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  
  // Create bind group for render pipeline
  const renderBindGroup = webgpuResult.device.createBindGroup({
    layout: pipelines.render.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: agentBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } },
    ],
  });
  
  // Render a frame
  const commandEncoder = webgpuResult.device.createCommandEncoder();
  const textureView = webgpuResult.context.getCurrentTexture().createView();
  
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
  
  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipelines.render);
  passEncoder.setBindGroup(0, renderBindGroup);
  passEncoder.draw(6, agentCount); // 6 vertices per quad, one instance per agent
  passEncoder.end();
  
  webgpuResult.device.queue.submit([commandEncoder.finish()]);
  
  console.log("Basic point rendering test completed!");
}

// Start the application
main();