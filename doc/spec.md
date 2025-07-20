```# WebGPU Flocking Simulation - Implementation Specification

## Overview
Build a GPU-accelerated boids flocking simulation using WebGPU compute shaders with spatial grid optimization for neighbor finding.

## Core Requirements

### 1. WebGPU Setup
- Initialize WebGPU device and canvas context
- Use preferred canvas format for rendering
- Error handling for unsupported browsers

### 2. Agent Data Structure
```javascript
// Agent struct (16 bytes total)
struct Agent {
    position: vec2f,  // x, y coordinates
    velocity: vec2f,  // vx, vy velocity components
}
```

### 3. Simulation Parameters
```javascript
params = {
    numAgents: 1000,           // Number of boids
    separationStrength: 1.0,   // Avoid crowding force
    alignmentStrength: 1.0,    // Match neighbor velocity force  
    cohesionStrength: 1.0,     // Move toward group center force
    maxSpeed: 2.0,             // Speed limit
    neighborRadius: 50.0,      // Interaction distance
    canvasWidth: 800,
    canvasHeight: 600,
    deltaTime: 0.016          // ~60fps
}
```

## Architecture

### 1. TypeScript Types
```typescript
type SimulationParams {
  readonly numAgents: number;
  readonly separationStrength: number;
  readonly alignmentStrength: number;
  readonly cohesionStrength: number;
  readonly maxSpeed: number;
  readonly neighborRadius: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly deltaTime: number;
}

type Agent {
  readonly position: readonly [number, number];
  readonly velocity: readonly [number, number];
}

type WebGPUResources {
  readonly device: GPUDevice;
  readonly context: GPUCanvasContext;
  readonly format: GPUTextureFormat;
}

type BufferSet {
  readonly agentBuffers: readonly [GPUBuffer, GPUBuffer];
  readonly uniformBuffer: GPUBuffer;
  readonly gridBuffer: GPUBuffer;
  readonly gridIndicesBuffer: GPUBuffer;
}

type PipelineSet {
  readonly computePipeline: GPUComputePipeline;
  readonly renderPipeline: GPURenderPipeline;
  readonly bindGroups: readonly [GPUBindGroup, GPUBindGroup];
}
```

### 2. TypeScript Module Structure

#### index.html
```html
<script type="module" src="js/main.js"></script>
```

#### src/main.ts
```typescript
import { initializeWebGPU } from './modules/webgpu.js';
import { createBufferSet, updateUniforms } from './modules/buffers.js';
import { loadShaders, createPipelines } from './modules/shaders.js';
```
- **Double-buffered agent storage**: Two identical buffers that swap each frame
- **Uniform buffer**: Simulation parameters (48 bytes)
- **Spatial grid buffer**: Grid cell contents for neighbor lookup
- **Grid indices buffer**: Starting indices for each grid cell

### 3. Buffer System
- **Double-buffered agent storage**: Two identical buffers that swap each frame
- **Uniform buffer**: Simulation parameters (48 bytes)
- **Spatial grid buffer**: Grid cell contents for neighbor lookup
- **Grid indices buffer**: Starting indices for each grid cell

### 4. Shader Files

#### compute.wgsl
- Implements spatial grid neighbor finding
- Applies three flocking forces
- Updates agent positions and velocities
- Handles boundary wrapping

#### vertex.wgsl  
- Transforms agent positions to clip space
- Passes velocity data to fragment shader
- Uses instanced rendering for all agents

#### fragment.wgsl
- Colors agents based on velocity magnitude
- Blue for slow agents, red for fast agents

### 5. Module Organization

#### src/main.ts
- Application entry point using TypeScript modules
- Coordinates all systems with strict typing
- Handles render loop and UI events
- Compiled to dist/js/main.js

#### src/modules/webgpu.ts
```typescript
export async function initializeWebGPU(canvas: HTMLCanvasElement): Promise<WebGPUResources>;
export function checkWebGPUSupport(): boolean;
```

#### src/modules/buffers.ts
```typescript
export function createBufferSet(device: GPUDevice, params: SimulationParams): BufferSet;
export function updateUniforms(device: GPUDevice, buffer: GPUBuffer, params: SimulationParams): void;
export function initializeAgents(params: SimulationParams): Float32Array;
```

#### src/modules/shaders.ts
```typescript
export async function loadShader(path: string): Promise<string>;
export function createPipelines(device: GPUDevice, shaderCode: ShaderCode): PipelineSet;
```

### 6. Shader Loading Strategy
```typescript
// Load shaders at runtime using fetch from dist/shader/
const shaderCode = {
  compute: await loadShader('./shader/compute.wgsl'),
  vertex: await loadShader('./shader/vertex.wgsl'),
  fragment: await loadShader('./shader/fragment.wgsl')
};
```

#### Compute Shader Requirements
- **Workgroup size**: 64 threads
- **Input**: Read from current agent buffer
- **Output**: Write to alternate agent buffer
- **Algorithm**:
  1. Get agent's grid cell coordinates
  2. Check 3x3 neighborhood of cells
  3. For each neighbor within radius:
     - Apply separation force (avoid crowding)
     - Apply alignment force (match velocity)
     - Apply cohesion force (move toward center)
  4. Update velocity with combined forces
  5. Limit speed to maxSpeed
  6. Update position with velocity
  7. Wrap around canvas edges

#### Vertex Shader Requirements
- **Input**: Agent buffer (current frame)
- **Output**: Screen position + velocity for coloring
- Transform world coordinates to clip space

#### Fragment Shader Requirements
- **Input**: Velocity from vertex shader
- **Output**: Color based on speed (blue=slow, red=fast)

### 3. Spatial Grid System

#### Grid Configuration
- **Cell size**: Equal to neighborRadius
- **Grid dimensions**: `ceil(canvasWidth/cellSize) × ceil(canvasHeight/cellSize)`
- **Max agents per cell**: 32 (fixed allocation)
- **Empty cell marker**: 0xFFFFFFFF

#### Grid Population Algorithm
1. Clear grid buffer each frame
2. For each agent, calculate grid cell
3. Add agent index to appropriate cell
4. Use atomic operations or pre-sorting to avoid conflicts

## Implementation Steps

### Phase 1: Project Setup
Complete

### Phase 2: WebGPU Foundation
1. Implement src/modules/webgpu.ts with Chrome-only browser checking
2. Create type-safe WebGPU initialization using @webgpu/types
3. Set up canvas context and device with proper typing
4. Add comprehensive error handling with TypeScript safety
5. Test WebGPU device creation from dist/

### Phase 3: Shader Development
1. Create src/shaders/ with compute.wgsl, vertex.wgsl, fragment.wgsl
2. Implement fetch-based shader loading in src/modules/shaders.ts
3. Ensure WGSL files are copied to dist/shaders/ during build
4. Add shader compilation error handling with types
5. Test basic point rendering

### Phase 4: Buffer Management
1. Implement src/modules/buffers.ts with strict TypeScript buffer creation
2. Create double-buffered agent storage with proper typing
3. Add uniform buffer for parameters
4. Implement spatial grid buffers
5. Add type-safe buffer utility functions

### Phase 5: Flocking Logic
1. Add brute-force neighbor finding to src/shaders/compute.wgsl
2. Implement three flocking forces with proper vector math
3. Add velocity limiting and position updates
4. Test flocking behavior with small agent count
5. Verify mathematical correctness

### Phase 6: Spatial Optimization
1. Implement spatial grid population in compute shader
2. Replace brute-force with grid-based neighbor search
3. Optimize memory access patterns
4. Add grid debugging capabilities
5. Performance test with large agent counts

### Phase 7: UI and Polish
1. Create responsive UI controls in src/main.ts with strict typing
2. Add real-time parameter adjustment
3. Implement FPS monitoring
4. Add agent count controls
5. Polish styling and user experience

## Performance Targets
- **1,000 agents**: 60+ FPS
- **5,000 agents**: 30+ FPS
- **Memory usage**: Minimize buffer allocations
- **GPU utilization**: Maximize parallel execution

## Validation Criteria

### Visual Behavior
- Agents form coherent flocks
- No agents overlap excessively (separation working)
- Flocks move together (alignment/cohesion working)
- Smooth movement without jitter

### Performance
- Stable frame rate
- No memory leaks
- Responsive parameter changes

### Technical
- Proper buffer synchronization
- No read/write conflicts
- Grid system working correctly

## Minimal Dependencies Approach
- **TypeScript only**: Essential for type safety with WebGPU APIs
- **No build tools**: Use `tsc --watch` for compilation only
- **No bundlers**: Native ES modules with import/export
- **No external libraries**: Pure web standards (WebGPU, ES2022, CSS)
- **Minimal package.json**: Only TypeScript compiler and @webgpu/types

## Debug Considerations
- **TypeScript safety**: Leverage strict compiler settings for compile-time error detection
- **Shader debugging**: Console logging of shader compilation errors with line numbers  
- **Buffer validation**: Type-safe buffer size calculations and bounds checking
- **Performance profiling**: Use browser DevTools for GPU timing
- **Parameter validation**: Runtime checks for parameter ranges with TypeScript guards
- **Grid visualization**: Optional debug rendering of spatial grid cells
- **Memory tracking**: Monitor buffer allocations in Chrome DevTools
- **CORS handling**: Serve files via local HTTP server for shader loading

## Browser Compatibility
- **Chrome 113+ only** (WebGPU enabled)
- Display error message for non-Chrome browsers

## Extensions (Optional)
- **Multi-species flocking**: Different agent types with varying behaviors
- **Environmental forces**: Wind, obstacles, attractors/repulsors  
- **3D flocking**: Extend to three dimensions with camera controls
- **Predator/prey dynamics**: Add chase/flee behaviors
- **Trail rendering**: Particle trails showing agent paths
- **Save/load configurations**: Serialize simulation states
- **Real-time shader editing**: Hot-reload WGSL shaders during development
- **Advanced spatial structures**: Octrees or spatial hashing for better performance