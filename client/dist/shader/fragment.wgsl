struct FragmentInput {
  @location(0) velocity: vec2<f32>,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
  // Calculate speed from velocity
  let speed = length(input.velocity);
  let maxSpeed = 5.0; // This should match the compute shader's max speed
  let normalizedSpeed = clamp(speed / maxSpeed, 0.0, 1.0);
  
  // Color based on speed: blue (slow) to red (fast)
  let blue = vec3<f32>(0.0, 0.0, 1.0);
  let red = vec3<f32>(1.0, 0.0, 0.0);
  let color = mix(blue, red, normalizedSpeed);
  
  return vec4<f32>(color, 1.0);
}