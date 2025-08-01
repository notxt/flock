struct Agent {
  position: vec2<f32>,
  velocity: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) velocity: vec2<f32>,
}

struct Uniforms {
  viewProjection: mat4x4<f32>,
  worldSize: vec2<f32>,
}

@group(0) @binding(0) var<storage, read> agents: array<Agent>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

@vertex
fn main(@builtin(instance_index) instanceIdx: u32, @builtin(vertex_index) vertexIdx: u32) -> VertexOutput {
  let agent = agents[instanceIdx];
  
  // Create a small quad for each agent
  let pointSize = 1.0;
  var vertices = array<vec2<f32>, 6>(
    vec2<f32>(-pointSize, -pointSize),
    vec2<f32>( pointSize, -pointSize),
    vec2<f32>( pointSize,  pointSize),
    vec2<f32>(-pointSize, -pointSize),
    vec2<f32>( pointSize,  pointSize),
    vec2<f32>(-pointSize,  pointSize)
  );
  
  let vertex = vertices[vertexIdx];
  let worldPos = vec4<f32>(agent.position + vertex, 0.0, 1.0);
  
  // Transform to normalized device coordinates
  let ndcX = (worldPos.x / uniforms.worldSize.x) * 2.0 - 1.0;
  let ndcY = (worldPos.y / uniforms.worldSize.y) * 2.0 - 1.0;
  
  var output: VertexOutput;
  output.position = vec4<f32>(ndcX, ndcY, 0.0, 1.0);
  output.velocity = agent.velocity;
  
  return output;
}