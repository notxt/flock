type SimulationParams = {
  readonly agentCount: number;
  readonly separationRadius: number;
  readonly alignmentRadius: number;
  readonly cohesionRadius: number;
  readonly separationForce: number;
  readonly alignmentForce: number;
  readonly cohesionForce: number;
  readonly maxSpeed: number;
  readonly worldSize: readonly [number, number];
  readonly neighborRadius: number;
  readonly gridCellSize: number;
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly maxAgentsPerCell: number;
  readonly edgeAvoidanceDistance: number;
  readonly edgeAvoidanceForce: number;
  readonly momentumSmoothing: number;
  readonly momentumDamping: number;
  readonly collisionRadius: number;
  readonly collisionForceMultiplier: number;
  readonly collisionScaling: number;
};

type BufferSet = {
  readonly agentBuffers: readonly [GPUBuffer, GPUBuffer];
  readonly uniformBuffer: GPUBuffer;
  readonly gridBuffer: GPUBuffer;
  readonly gridIndicesBuffer: GPUBuffer;
  readonly params: SimulationParams;
};

type GridConfig = {
  readonly cellSize: number;
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly maxAgentsPerCell: number;
};

const AGENT_SIZE_BYTES = 32; // 8 floats: x, y, vx, vy, prevAccelX, prevAccelY, padX, padY
const UNIFORM_SIZE_BYTES = 100; // SimParams struct size with deltaTime, neighborRadius, grid parameters, edge avoidance, momentum parameters, collision parameters, and scaling
const MAX_AGENTS_PER_CELL = 128;
const EMPTY_CELL_MARKER = 0xFFFFFFFF;

function calculateGridConfig(worldSize: readonly [number, number], neighborRadius: number): GridConfig {
  const cellSize = neighborRadius;
  const gridWidth = Math.ceil(worldSize[0] / cellSize);
  const gridHeight = Math.ceil(worldSize[1] / cellSize);
  
  return {
    cellSize,
    gridWidth,
    gridHeight,
    maxAgentsPerCell: MAX_AGENTS_PER_CELL,
  };
}

function createAgentBuffer(device: GPUDevice, agentCount: number): GPUBuffer {
  const size = agentCount * AGENT_SIZE_BYTES;
  return device.createBuffer({
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
}

function createUniformBuffer(device: GPUDevice): GPUBuffer {
  return device.createBuffer({
    size: UNIFORM_SIZE_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

function createGridBuffer(device: GPUDevice, gridConfig: GridConfig): GPUBuffer {
  const cellCount = gridConfig.gridWidth * gridConfig.gridHeight;
  const size = cellCount * gridConfig.maxAgentsPerCell * 4; // uint32 per agent index
  
  return device.createBuffer({
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
}

function createGridIndicesBuffer(device: GPUDevice, gridConfig: GridConfig): GPUBuffer {
  const cellCount = gridConfig.gridWidth * gridConfig.gridHeight;
  const size = cellCount * 4; // uint32 per cell for starting index
  
  return device.createBuffer({
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
}

export function createBufferSet(device: GPUDevice, inputParams: Omit<SimulationParams, 'gridCellSize' | 'gridWidth' | 'gridHeight' | 'maxAgentsPerCell'>): BufferSet {
  const gridConfig = calculateGridConfig(inputParams.worldSize, inputParams.neighborRadius);
  
  // Create complete SimulationParams with grid parameters
  const params: SimulationParams = {
    ...inputParams,
    gridCellSize: gridConfig.cellSize,
    gridWidth: gridConfig.gridWidth,
    gridHeight: gridConfig.gridHeight,
    maxAgentsPerCell: gridConfig.maxAgentsPerCell,
  };
  
  const agentBuffer1 = createAgentBuffer(device, params.agentCount);
  const agentBuffer2 = createAgentBuffer(device, params.agentCount);
  const uniformBuffer = createUniformBuffer(device);
  
  const gridBuffer = createGridBuffer(device, gridConfig);
  const gridIndicesBuffer = createGridIndicesBuffer(device, gridConfig);
  
  // Initialize agent buffers with initial data
  const initialAgentData = initializeAgents(params);
  device.queue.writeBuffer(agentBuffer1, 0, initialAgentData);
  device.queue.writeBuffer(agentBuffer2, 0, initialAgentData);
  
  // Initialize uniform buffer with deltaTime = 1.0 (equivalent to 60fps baseline)
  updateUniforms(device, uniformBuffer, params, 1.0);
  
  // Initialize grid buffers with empty markers
  const cellCount = gridConfig.gridWidth * gridConfig.gridHeight;
  const emptyGrid = new Uint32Array(cellCount * gridConfig.maxAgentsPerCell);
  emptyGrid.fill(EMPTY_CELL_MARKER);
  device.queue.writeBuffer(gridBuffer, 0, emptyGrid);
  
  const emptyIndices = new Uint32Array(cellCount);
  emptyIndices.fill(0);
  device.queue.writeBuffer(gridIndicesBuffer, 0, emptyIndices);
  
  return {
    agentBuffers: [agentBuffer1, agentBuffer2],
    uniformBuffer,
    gridBuffer,
    gridIndicesBuffer,
    params,
  };
}

export function updateUniforms(device: GPUDevice, buffer: GPUBuffer, params: SimulationParams, deltaTime: number): void {
  const uniformData = new ArrayBuffer(UNIFORM_SIZE_BYTES);
  const view = new DataView(uniformData);
  
  // Pack SimParams struct according to WGSL layout
  view.setUint32(0, params.agentCount, true);
  view.setFloat32(4, params.separationRadius, true);
  view.setFloat32(8, params.alignmentRadius, true);
  view.setFloat32(12, params.cohesionRadius, true);
  view.setFloat32(16, params.separationForce, true);
  view.setFloat32(20, params.alignmentForce, true);
  view.setFloat32(24, params.cohesionForce, true);
  view.setFloat32(28, params.maxSpeed, true);
  view.setFloat32(32, params.worldSize[0], true);
  view.setFloat32(36, params.worldSize[1], true);
  view.setFloat32(40, params.neighborRadius, true);
  view.setFloat32(44, deltaTime, true);
  view.setFloat32(48, params.gridCellSize, true);
  view.setUint32(52, params.gridWidth, true);
  view.setUint32(56, params.gridHeight, true);
  view.setUint32(60, params.maxAgentsPerCell, true);
  view.setFloat32(64, params.edgeAvoidanceDistance, true);
  view.setFloat32(68, params.edgeAvoidanceForce, true);
  view.setFloat32(72, params.momentumSmoothing, true);
  view.setFloat32(76, params.momentumDamping, true);
  view.setFloat32(80, params.collisionRadius, true);
  view.setFloat32(84, params.collisionForceMultiplier, true);
  view.setFloat32(88, params.collisionScaling, true);
  // Padding to align to 16 bytes
  view.setFloat32(92, 0, true);
  view.setFloat32(96, 0, true);
  
  device.queue.writeBuffer(buffer, 0, uniformData);
}

export function initializeAgents(params: SimulationParams): Float32Array {
  const agentData = new Float32Array(params.agentCount * 8);
  
  // Initialize agents with random positions and velocities
  for (let i = 0; i < params.agentCount; i++) {
    const offset = i * 8;
    agentData[offset + 0] = Math.random() * params.worldSize[0];      // x position
    agentData[offset + 1] = Math.random() * params.worldSize[1];      // y position
    agentData[offset + 2] = (Math.random() - 0.5) * params.maxSpeed;  // x velocity
    agentData[offset + 3] = (Math.random() - 0.5) * params.maxSpeed;  // y velocity
    agentData[offset + 4] = 0.0;                                      // previousAcceleration.x
    agentData[offset + 5] = 0.0;                                      // previousAcceleration.y
    agentData[offset + 6] = 0.0;                                      // padding.x
    agentData[offset + 7] = 0.0;                                      // padding.y
  }
  
  return agentData;
}

// Export types for use in other modules
export type { SimulationParams, BufferSet, GridConfig };