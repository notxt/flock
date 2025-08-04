@group(0) @binding(0) var<storage, read_write> gridIndices: array<u32>;

@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= arrayLength(&gridIndices)) {
    return;
  }
  
  // Clear the grid indices array
  gridIndices[idx] = 0u;
}