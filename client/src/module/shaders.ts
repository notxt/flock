/// <reference types="@webgpu/types" />

type ShaderCode = {
  readonly compute: string;
  readonly gridPopulate: string;
  readonly vertex: string;
  readonly fragment: string;
};

type PipelineSet = {
  readonly compute: GPUComputePipeline;
  readonly gridPopulate: GPUComputePipeline;
  readonly render: GPURenderPipeline;
};

export async function loadShader(path: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(path);
  } catch (e) {
    return Promise.reject(new Error(`Failed to fetch shader from ${path}`));
  }
  
  if (!response.ok) {
    return Promise.reject(new Error(`Failed to load shader ${path}: ${response.status} ${response.statusText}`));
  }
  
  let shaderCode: string;
  try {
    shaderCode = await response.text();
  } catch (e) {
    return Promise.reject(new Error(`Failed to read shader text from ${path}`));
  }
  
  return shaderCode;
}

export function createPipelines(device: GPUDevice, shaderCode: ShaderCode): PipelineSet {
  // Create compute shader module
  let computeModule: GPUShaderModule;
  try {
    computeModule = device.createShaderModule({
      label: "Compute shader",
      code: shaderCode.compute,
    });
  } catch (e) {
    throw new Error(`Failed to compile compute shader: ${e instanceof Error ? e.message : String(e)}`);
  }
  
  // Create grid populate shader module
  let gridPopulateModule: GPUShaderModule;
  try {
    gridPopulateModule = device.createShaderModule({
      label: "Grid populate shader",
      code: shaderCode.gridPopulate,
    });
  } catch (e) {
    throw new Error(`Failed to compile grid populate shader: ${e instanceof Error ? e.message : String(e)}`);
  }
  
  // Create vertex shader module
  let vertexModule: GPUShaderModule;
  try {
    vertexModule = device.createShaderModule({
      label: "Vertex shader",
      code: shaderCode.vertex,
    });
  } catch (e) {
    throw new Error(`Failed to compile vertex shader: ${e instanceof Error ? e.message : String(e)}`);
  }
  
  // Create fragment shader module
  let fragmentModule: GPUShaderModule;
  try {
    fragmentModule = device.createShaderModule({
      label: "Fragment shader",
      code: shaderCode.fragment,
    });
  } catch (e) {
    throw new Error(`Failed to compile fragment shader: ${e instanceof Error ? e.message : String(e)}`);
  }
  
  // Create compute pipeline
  const computePipeline = device.createComputePipeline({
    label: "Flocking compute pipeline",
    layout: "auto",
    compute: {
      module: computeModule,
      entryPoint: "main",
    },
  });
  
  // Create grid populate pipeline
  const gridPopulatePipeline = device.createComputePipeline({
    label: "Grid populate compute pipeline",
    layout: "auto",
    compute: {
      module: gridPopulateModule,
      entryPoint: "main",
    },
  });
  
  // Create render pipeline
  const renderPipeline = device.createRenderPipeline({
    label: "Agent render pipeline",
    layout: "auto",
    vertex: {
      module: vertexModule,
      entryPoint: "main",
    },
    fragment: {
      module: fragmentModule,
      entryPoint: "main",
      targets: [{
        format: navigator.gpu.getPreferredCanvasFormat(),
      }],
    },
    primitive: {
      topology: "triangle-list",
    },
  });
  
  return {
    compute: computePipeline,
    gridPopulate: gridPopulatePipeline,
    render: renderPipeline,
  };
}