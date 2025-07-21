/// <reference types="@webgpu/types" />

type WebGPUResources = {
  readonly device: GPUDevice;
  readonly context: GPUCanvasContext;
  readonly format: GPUTextureFormat;
};

export function checkWebGPUSupport(): boolean {
  // Check if we're in Chrome
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  
  if (!isChrome) {
    return false;
  }
  
  // Check if WebGPU is available
  return "gpu" in navigator && navigator.gpu !== null;
}

export async function initializeWebGPU(canvas: HTMLCanvasElement): Promise<WebGPUResources | Error> {
  // Check browser support
  if (!checkWebGPUSupport()) {
    return new Error("WebGPU is only supported in Chrome 113+. Please use Chrome browser with WebGPU enabled.");
  }
  
  // Check if navigator.gpu exists
  if (!navigator.gpu) {
    return new Error("WebGPU is not available. Please ensure you're using Chrome 113+ with WebGPU enabled.");
  }
  
  // Request adapter
  let adapter: GPUAdapter | null;
  try {
    adapter = await navigator.gpu.requestAdapter();
  } catch (e) {
    return new Error("Failed to request WebGPU adapter");
  }
  
  if (!adapter) {
    return new Error("No appropriate GPUAdapter found");
  }
  
  // Request device
  let device: GPUDevice;
  try {
    device = await adapter.requestDevice();
  } catch (e) {
    return new Error("Failed to request WebGPU device");
  }
  
  // Get canvas context
  const context = canvas.getContext("webgpu");
  if (!context) {
    return new Error("Failed to get WebGPU context from canvas");
  }
  
  // Get preferred canvas format
  const format = navigator.gpu.getPreferredCanvasFormat();
  
  // Configure the context
  try {
    context.configure({
      device: device,
      format: format,
      alphaMode: "premultiplied",
    });
  } catch (e) {
    return new Error("Failed to configure WebGPU context");
  }
  
  return {
    device: device,
    context: context,
    format: format,
  };
}