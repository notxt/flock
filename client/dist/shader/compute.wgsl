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
}

@group(0) @binding(0) var<storage, read> agentsIn: array<Agent>;
@group(0) @binding(1) var<storage, read_write> agentsOut: array<Agent>;
@group(0) @binding(2) var<uniform> params: SimParams;

@compute @workgroup_size(64)
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
  
  // Check all other agents using different radii for each behavior
  for (var i: u32 = 0u; i < params.agentCount; i = i + 1u) {
    if (i == idx) {
      continue;
    }
    
    let other = agentsIn[i];
    let diff = agent.position - other.position;
    let distSq = dot(diff, diff);
    
    // Separation - closest interactions, avoid crowding
    if (distSq < params.separationRadius * params.separationRadius && distSq > 0.0) {
      let dist = sqrt(distSq);
      separation = separation + (diff / dist);
      separationCount = separationCount + 1u;
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
  
  // Calculate acceleration from forces
  var acceleration = vec2<f32>(0.0, 0.0);
  
  // Separation: avoid crowding
  if (separationCount > 0u) {
    separation = normalize(separation / f32(separationCount)) * params.separationForce;
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
  
  // Update velocity with acceleration over time
  var velocity = agent.velocity + acceleration * params.deltaTime;
  
  // Limit speed
  let speed = length(velocity);
  if (speed > params.maxSpeed) {
    velocity = normalize(velocity) * params.maxSpeed;
  }
  
  // Update position with deltaTime
  var position = agent.position + velocity * params.deltaTime;
  
  // Wrap around boundaries
  if (position.x < 0.0) {
    position.x = position.x + params.worldSize.x;
  } else if (position.x > params.worldSize.x) {
    position.x = position.x - params.worldSize.x;
  }
  
  if (position.y < 0.0) {
    position.y = position.y + params.worldSize.y;
  } else if (position.y > params.worldSize.y) {
    position.y = position.y - params.worldSize.y;
  }
  
  // Write output
  agentsOut[idx].position = position;
  agentsOut[idx].velocity = velocity;
}