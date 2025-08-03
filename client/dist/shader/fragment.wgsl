struct FragmentInput {
  @location(0) velocity: vec2<f32>,
  @location(1) collisionFlag: f32,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
  // Check if the boid is colliding (emergency state)
  if (input.collisionFlag > 0.5) {
    // Bright magenta color for colliding boids
    return vec4<f32>(1.0, 0.0, 1.0, 1.0);
  }
  
  // Calculate speed from velocity for non-colliding boids
  let speed = length(input.velocity);
  let maxSpeed = 5.0; // This should match the compute shader's max speed
  let normalizedSpeed = clamp(speed / maxSpeed, 0.0, 1.0);
  
  // Color based on speed: light cyan (slow) to bright white (fast)
  let lightCyan = vec3<f32>(0.6, 0.9, 1.0);
  let brightWhite = vec3<f32>(1.0, 1.0, 1.0);
  let color = mix(lightCyan, brightWhite, normalizedSpeed);
  
  return vec4<f32>(color, 1.0);
}