struct Agent {
  position: vec2<f32>,
  velocity: vec2<f32>,
  previousAcceleration: vec2<f32>,
  padding: vec2<f32>,
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
  edgeAvoidanceDistance: f32,
  edgeAvoidanceForce: f32,
  momentumSmoothing: f32,
  momentumDamping: f32,
  collisionRadius: f32,
  collisionForceMultiplier: f32,
  collisionScaling: f32,
  maxNeighbors: u32,
}

@group(0) @binding(0) var<storage, read> agentsIn: array<Agent>;
@group(0) @binding(1) var<storage, read_write> agentsOut: array<Agent>;
@group(0) @binding(2) var<uniform> params: SimParams;
@group(0) @binding(3) var<storage, read> gridData: array<u32>;
@group(0) @binding(4) var<storage, read> gridIndices: array<u32>;

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

@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= params.agentCount) {
    return;
  }
  
  let agent = agentsIn[idx];
  var separation = vec2<f32>(0.0, 0.0);
  var alignment = vec2<f32>(0.0, 0.0);
  var cohesion = vec2<f32>(0.0, 0.0);
  var separationCount: u32 = 0u;
  var alignmentCount: u32 = 0u;
  var cohesionCount: u32 = 0u;
  var neighborsProcessed: u32 = 0u;
  var isColliding = false;
  
  // Get current agent's grid cell
  let agentGridPos = worldToGrid(agent.position);
  
  // Check 3x3 neighborhood around current cell
  for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {
    if (neighborsProcessed >= params.maxNeighbors) {
      break;
    }
    for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {
      if (neighborsProcessed >= params.maxNeighbors) {
        break;
      }
      let neighborX = i32(agentGridPos.x) + dx;
      let neighborY = i32(agentGridPos.y) + dy;
      
      // Skip if neighbor cell is out of bounds
      if (neighborX < 0 || neighborX >= i32(params.gridWidth) ||
          neighborY < 0 || neighborY >= i32(params.gridHeight)) {
        continue;
      }
      
      let neighborGridPos = vec2<u32>(u32(neighborX), u32(neighborY));
      let neighborCellIdx = gridToIndex(neighborGridPos);
      let neighborCount = gridIndices[neighborCellIdx];
      
      // Check all agents in this neighbor cell
      for (var i: u32 = 0u; i < min(neighborCount, params.maxAgentsPerCell); i = i + 1u) {
        if (neighborsProcessed >= params.maxNeighbors) {
          break;
        }
        let neighborGridDataIdx = neighborCellIdx * params.maxAgentsPerCell + i;
        let neighborIdx = gridData[neighborGridDataIdx];
        
        // Skip if this is the same agent or invalid index
        if (neighborIdx == idx || neighborIdx == EMPTY_CELL_MARKER || neighborIdx >= params.agentCount) {
          continue;
        }
        
        // Early termination: stop processing neighbors if we've reached the limit
        if (neighborsProcessed >= params.maxNeighbors) {
          break;
        }
        
        neighborsProcessed = neighborsProcessed + 1u;
        
        let other = agentsIn[neighborIdx];
        let diff = agent.position - other.position;
        let distSq = dot(diff, diff);
        
        // Unified distance-based separation with scaling
        if (distSq < params.separationRadius * params.separationRadius && distSq > 0.0) {
          let dist = sqrt(distSq);
          
          // Calculate distance-based force scaling: closer = stronger force
          // forceScale = max(1.0, (collisionRadius / distance)^collisionScaling)
          let forceScale = max(1.0, pow(params.collisionRadius / dist, params.collisionScaling));
          
          // Apply scaled separation force
          let scaledForce = (diff / dist) * forceScale;
          separation = separation + scaledForce;
          separationCount = separationCount + 1u;
          
          // Flag as colliding only when occupying same space (distance ≈ 0)
          if (dist < 1.0) {
            isColliding = true;
          }
        }
        
        // Alignment - medium range, match neighbor velocities
        if (distSq < params.alignmentRadius * params.alignmentRadius) {
          alignment = alignment + other.velocity;
          alignmentCount = alignmentCount + 1u;
        }
        
        // Cohesion - medium range, move toward group center
        if (distSq < params.cohesionRadius * params.cohesionRadius) {
          cohesion = cohesion + other.position;
          cohesionCount = cohesionCount + 1u;
        }
      }
    }
  }
  
  // Calculate acceleration from forces
  var acceleration = vec2<f32>(0.0, 0.0);
  
  // Separation: avoid crowding with gentle density-based scaling
  if (separationCount > 0u) {
    // Scale force based on local density: more neighbors = slightly stronger force
    let densityScale = 1.0 + (f32(separationCount) - 1.0) * 0.05;
    separation = normalize(separation) * params.separationForce * densityScale;
    acceleration = acceleration + separation;
  }
  
  // Alignment: match neighbor velocities
  if (alignmentCount > 0u) {
    alignment = normalize(alignment / f32(alignmentCount)) * params.alignmentForce;
    acceleration = acceleration + alignment;
  }
  
  // Cohesion: move toward group center
  if (cohesionCount > 0u) {
    cohesion = (cohesion / f32(cohesionCount)) - agent.position;
    cohesion = normalize(cohesion) * params.cohesionForce;
    acceleration = acceleration + cohesion;
  }
  
  // Calculate edge avoidance force
  var edgeForce = vec2<f32>(0.0, 0.0);
  
  // Left edge
  if (agent.position.x < params.edgeAvoidanceDistance) {
    let distance = agent.position.x;
    let force = (params.edgeAvoidanceDistance - distance) / params.edgeAvoidanceDistance;
    edgeForce.x = edgeForce.x + force * params.edgeAvoidanceForce;
  }
  
  // Right edge
  if (agent.position.x > params.worldSize.x - params.edgeAvoidanceDistance) {
    let distance = params.worldSize.x - agent.position.x;
    let force = (params.edgeAvoidanceDistance - distance) / params.edgeAvoidanceDistance;
    edgeForce.x = edgeForce.x - force * params.edgeAvoidanceForce;
  }
  
  // Top edge
  if (agent.position.y < params.edgeAvoidanceDistance) {
    let distance = agent.position.y;
    let force = (params.edgeAvoidanceDistance - distance) / params.edgeAvoidanceDistance;
    edgeForce.y = edgeForce.y + force * params.edgeAvoidanceForce;
  }
  
  // Bottom edge
  if (agent.position.y > params.worldSize.y - params.edgeAvoidanceDistance) {
    let distance = params.worldSize.y - agent.position.y;
    let force = (params.edgeAvoidanceDistance - distance) / params.edgeAvoidanceDistance;
    edgeForce.y = edgeForce.y - force * params.edgeAvoidanceForce;
  }
  
  // Apply edge force to acceleration
  acceleration = acceleration + edgeForce;
  
  // Momentum-based physics: smooth acceleration changes for more natural movement
  let smoothedAcceleration = mix(agent.previousAcceleration, acceleration, params.momentumSmoothing);
  
  // Apply damping to reduce oscillations and create smoother movement
  let dampedAcceleration = smoothedAcceleration * (1.0 - params.momentumDamping);
  
  // Update velocity with smoothed and damped acceleration
  var velocity = agent.velocity + dampedAcceleration * params.deltaTime;
  
  // Soft speed limiting: gradually reduce velocity as it approaches max speed
  let speed = length(velocity);
  if (speed > 0.0) {
    let speedRatio = speed / params.maxSpeed;
    if (speedRatio > 1.0) {
      // Apply exponential decay for smoother speed limiting
      let dampingFactor = exp(-speedRatio + 1.0);
      velocity = velocity * dampingFactor;
    }
  }
  
  // Update position with deltaTime
  var position = agent.position + velocity * params.deltaTime;
  
  // Clamp position to stay within boundaries as safety net
  position.x = clamp(position.x, 0.0, params.worldSize.x);
  position.y = clamp(position.y, 0.0, params.worldSize.y);
  
  // Write output
  agentsOut[idx].position = position;
  agentsOut[idx].velocity = velocity;
  agentsOut[idx].previousAcceleration = dampedAcceleration;
  // Store collision flag in padding.x (1.0 if colliding, 0.0 if not)
  agentsOut[idx].padding = vec2<f32>(select(0.0, 1.0, isColliding), 0.0);
}