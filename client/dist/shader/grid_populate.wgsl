struct Agent {
  position: vec2<f32>,
  velocity: vec2<f32>,
}

struct SimParams {
  agentCount: u32,
  separationRadius: f32,
  alignmentRadius: f32,
  cohesionRadius: f32,
  separationForce: f32,
  alignmentForce: f32,
  cohesionForce: f32,
  maxSpeed: f32,
  worldSize: vec2<f32>,
  neighborRadius: f32,
  deltaTime: f32,
  gridCellSize: f32,
  gridWidth: u32,
  gridHeight: u32,
  maxAgentsPerCell: u32,
}

@group(0) @binding(0) var<storage, read> agents: array<Agent>;
@group(0) @binding(1) var<storage, read_write> gridData: array<u32>;
@group(0) @binding(2) var<storage, read_write> gridIndices: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params: SimParams;

const EMPTY_CELL_MARKER: u32 = 0xFFFFFFFFu;

// Convert world position to grid coordinates
fn worldToGrid(position: vec2<f32>) -> vec2<u32> {
  var gridPos = vec2<u32>(
    u32(position.x / params.gridCellSize),
    u32(position.y / params.gridCellSize)
  );
  
  // Clamp to grid bounds
  gridPos.x = min(gridPos.x, params.gridWidth - 1u);
  gridPos.y = min(gridPos.y, params.gridHeight - 1u);
  
  return gridPos;
}

// Convert grid coordinates to linear cell index
fn gridToIndex(gridPos: vec2<u32>) -> u32 {
  return gridPos.y * params.gridWidth + gridPos.x;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let agentIdx = global_id.x;
  if (agentIdx >= params.agentCount) {
    return;
  }
  
  let agent = agents[agentIdx];
  let gridPos = worldToGrid(agent.position);
  let cellIdx = gridToIndex(gridPos);
  
  // Atomically get next available slot in this cell
  let slotIdx = atomicAdd(&gridIndices[cellIdx], 1u);
  
  // Only add agent if there's space in the cell
  if (slotIdx < params.maxAgentsPerCell) {
    let gridDataIdx = cellIdx * params.maxAgentsPerCell + slotIdx;
    gridData[gridDataIdx] = agentIdx;
  }
}