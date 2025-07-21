import { initializeWebGPU, checkWebGPUSupport } from "./module/webgpu.js";

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
  
  // Clear the canvas with a dark blue color to verify WebGPU is working
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
  passEncoder.end();
  
  webgpuResult.device.queue.submit([commandEncoder.finish()]);
}

// Start the application
main();