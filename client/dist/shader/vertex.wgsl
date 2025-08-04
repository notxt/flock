struct Agent {
  position: vec2<f32>,
  velocity: vec2<f32>,
  previousAcceleration: vec2<f32>,
  padding: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) velocity: vec2<f32>,
  @location(1) collisionFlag: f32,
}

struct Uniforms {
  viewProjection: mat4x4<f32>,
  worldSize: vec2<f32>,
}

@group(0) @binding(0) var<storage, read> agents: array<Agent>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

@vertex
fn main(@builtin(vertex_index) vertexIdx: u32) -> VertexOutput {
  let agent = agents[vertexIdx];
  
  // Transform to normalized device coordinates
  let ndcX = (agent.position.x / uniforms.worldSize.x) * 2.0 - 1.0;
  let ndcY = (agent.position.y / uniforms.worldSize.y) * 2.0 - 1.0;
  
  var output: VertexOutput;
  output.position = vec4<f32>(ndcX, ndcY, 0.0, 1.0);
  output.velocity = agent.velocity;
  output.collisionFlag = agent.padding.x;
  
  return output;
}