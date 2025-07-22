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
  var neighborCount: u32 = 0u;
  
  // Check all other agents using single neighborRadius
  for (var i: u32 = 0u; i < params.agentCount; i = i + 1u) {
    if (i == idx) {
      continue;
    }
    
    let other = agentsIn[i];
    let diff = agent.position - other.position;
    let distSq = dot(diff, diff);
    let neighborRadiusSq = params.neighborRadius * params.neighborRadius;
    
    // Only process agents within neighbor radius
    if (distSq < neighborRadiusSq && distSq > 0.0) {
      let dist = sqrt(distSq);
      
      // Separation: move away from neighbors (stronger when closer)
      separation = separation + (diff / dist) / dist;
      
      // Alignment: match neighbor velocities
      alignment = alignment + other.velocity;
      
      // Cohesion: move toward average neighbor position
      cohesion = cohesion + other.position;
      
      neighborCount = neighborCount + 1u;
    }
  }
  
  // Calculate forces
  var velocity = agent.velocity;
  
  if (neighborCount > 0u) {
    let neighborCountF = f32(neighborCount);
    
    // Separation: normalize and apply strength
    if (length(separation) > 0.0) {
      separation = normalize(separation) * params.separationForce;
      velocity = velocity + separation;
    }
    
    // Alignment: average neighbor velocities and apply strength
    alignment = alignment / neighborCountF;
    if (length(alignment) > 0.0) {
      alignment = normalize(alignment) * params.alignmentForce;
      velocity = velocity + alignment;
    }
    
    // Cohesion: steer toward average neighbor position
    cohesion = (cohesion / neighborCountF) - agent.position;
    if (length(cohesion) > 0.0) {
      cohesion = normalize(cohesion) * params.cohesionForce;
      velocity = velocity + cohesion;
    }
  }
  
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