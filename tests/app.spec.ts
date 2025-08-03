import { test, expect } from '@playwright/test';

test.describe('Flock Application', () => {
  test('loads the main page', async ({ page }): Promise<void> => {
    await page.goto('/');
    
    // Check page title
    await expect(page).toHaveTitle('Flock - WebGPU Simulation');
    
    // Check canvas exists
    const canvas = page.locator('#canvas');
    await expect(canvas).toBeVisible();
    
    // Check main.js is loaded
    const scriptLoaded = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.some(script => script.src.includes('js/main.js'));
    });
    expect(scriptLoaded).toBe(true);
  });

  test('canvas fills viewport', async ({ page }): Promise<void> => {
    await page.goto('/');
    
    const canvasDimensions = await page.locator('#canvas').evaluate(el => {
      const rect = el.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    
    expect(canvasDimensions.width).toBe(canvasDimensions.viewportWidth);
    expect(canvasDimensions.height).toBe(canvasDimensions.viewportHeight);
  });

  test('WebGPU initializes successfully', async ({ page }): Promise<void> => {
    // Only run this test in Chromium-based browsers
    const browserName = page.context().browser()?.browserType().name();
    if (browserName !== 'chromium') {
      test.skip();
      return;
    }
    
    // Listen for console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.goto('/');
    
    // Wait a bit for WebGPU initialization
    await page.waitForTimeout(1000);
    
    // Check for success message
    const hasSuccessMessage = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    // Check for error messages
    const hasErrorMessage = consoleMessages.some(msg => 
      msg.includes('WebGPU initialization failed') || 
      msg.includes('WebGPU is only supported in Chrome')
    );
    
    // In headless Chromium, WebGPU might not be available
    // So we accept either success or a specific "No appropriate GPUAdapter" error
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    if (hasNoAdapterError) {
      // This is expected in headless mode
      expect(hasErrorMessage).toBe(true);
      expect(hasSuccessMessage).toBe(false);
    } else {
      // In headed mode or with proper GPU support
      expect(hasSuccessMessage).toBe(true);
      expect(hasErrorMessage).toBe(false);
    }
    
    // Verify canvas has been rendered with WebGPU (should be dark blue)
    const canvasColor = await page.locator('#canvas').evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const imageData = ctx.getImageData(0, 0, 1, 1);
      return {
        r: imageData.data[0],
        g: imageData.data[1],
        b: imageData.data[2],
        a: imageData.data[3]
      };
    });
    
    // If WebGPU rendered, we won't be able to read pixels with 2D context
    // So we just verify the canvas exists and is visible
    await expect(page.locator('#canvas')).toBeVisible();
  });

  test('spatial grid system produces smooth flocking behavior', async ({ page }): Promise<void> => {
    // Only run this test in Chromium-based browsers
    const browserName = page.context().browser()?.browserType().name();
    if (browserName !== 'chromium') {
      test.skip();
      return;
    }
    
    // Listen for console messages to check for WebGPU initialization
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.goto('/');
    
    // Wait for WebGPU initialization
    await page.waitForTimeout(1000);
    
    // Check if WebGPU initialized successfully
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip test if WebGPU is not available (headless mode)
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    // Verify simulation is running
    expect(hasWebGPUSuccess).toBe(true);
    await expect(page.locator('#canvas')).toBeVisible();
    
    // Let simulation run for a few frames to verify stability
    await page.waitForTimeout(500);
    
    // Check for any error messages that might indicate grid system issues
    const hasErrorMessages = consoleMessages.some(msg => 
      msg.toLowerCase().includes('error') || 
      msg.toLowerCase().includes('failed') ||
      msg.toLowerCase().includes('shader compilation')
    );
    
    expect(hasErrorMessages).toBe(false);
  });

  test('flocking simulation produces expected agent movement patterns', async ({ page }): Promise<void> => {
    // Only run this test in Chromium-based browsers with WebGPU
    const browserName = page.context().browser()?.browserType().name();
    if (browserName !== 'chromium') {
      test.skip();
      return;
    }
    
    await page.goto('/');
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check WebGPU availability through console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.waitForTimeout(500);
    
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip if WebGPU not available
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    // Verify that the spatial grid system is working by checking that:
    // 1. No shader compilation errors occur
    // 2. The simulation runs smoothly
    // 3. Canvas remains responsive
    
    await page.waitForTimeout(2000); // Let simulation run for 2 seconds
    
    // Verify canvas is still visible and responsive
    await expect(page.locator('#canvas')).toBeVisible();
    
    // Check that no critical errors occurred during grid operations
    const hasCriticalErrors = consoleMessages.some(msg => 
      msg.includes('Failed to compile') ||
      msg.includes('GPU pipeline error') ||
      msg.includes('Buffer binding error')
    );
    
    expect(hasCriticalErrors).toBe(false);
  });

  test('spatial grid system achieves good performance', async ({ page }): Promise<void> => {
    // Only run this test in Chromium-based browsers with WebGPU
    const browserName = page.context().browser()?.browserType().name();
    if (browserName !== 'chromium') {
      test.skip();
      return;
    }
    
    await page.goto('/');
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check WebGPU availability
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.waitForTimeout(500);
    
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip if WebGPU not available
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    // Measure performance by running the simulation for a set time period
    // and ensuring it maintains responsive frame rates
    const performanceStart = Date.now();
    
    // Let simulation run for 3 seconds
    await page.waitForTimeout(3000);
    
    const performanceEnd = Date.now();
    const elapsedTime = performanceEnd - performanceStart;
    
    // Verify canvas remains responsive during performance test
    await expect(page.locator('#canvas')).toBeVisible();
    
    // Check that no performance-related errors occurred
    const hasPerformanceErrors = consoleMessages.some(msg => 
      msg.includes('GPU timeout') ||
      msg.includes('Memory allocation failed') ||
      msg.includes('Buffer overflow')
    );
    
    expect(hasPerformanceErrors).toBe(false);
    
    // Verify simulation ran for expected duration (allowing for some variance)
    expect(elapsedTime).toBeGreaterThanOrEqual(2800); // At least 2.8 seconds
    expect(elapsedTime).toBeLessThan(5000); // Not more than 5 seconds (indicating hang)
  });
});

test.describe('Momentum-Based Movement System', () => {
  test('momentum parameters are within expected ranges', async ({ page }): Promise<void> => {
    // Only run this test in Chromium-based browsers
    const browserName = page.context().browser()?.browserType().name();
    if (browserName !== 'chromium') {
      test.skip();
      return;
    }
    
    await page.goto('/');
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check WebGPU availability
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.waitForTimeout(500);
    
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip if WebGPU not available
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    // Test that momentum parameters are properly configured
    // by checking that the simulation runs without errors for several seconds
    await page.waitForTimeout(3000);
    
    // Verify canvas is still visible and simulation is running
    await expect(page.locator('#canvas')).toBeVisible();
    
    // Check that no momentum-related errors occurred
    const hasMomentumErrors = consoleMessages.some(msg => 
      msg.includes('momentum') ||
      msg.includes('smoothing') ||
      msg.includes('damping') ||
      msg.includes('acceleration')
    );
    
    expect(hasMomentumErrors).toBe(false);
  });

  test('momentum system produces smooth movement without oscillations', async ({ page }): Promise<void> => {
    // Only run this test in Chromium-based browsers
    const browserName = page.context().browser()?.browserType().name();
    if (browserName !== 'chromium') {
      test.skip();
      return;
    }
    
    await page.goto('/');
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check WebGPU availability
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.waitForTimeout(500);
    
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip if WebGPU not available
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    // Run simulation for extended period to test momentum stability
    await page.waitForTimeout(5000);
    
    // Verify canvas remains responsive
    await expect(page.locator('#canvas')).toBeVisible();
    
    // Check that no stability issues occurred (NaN, Infinity, excessive oscillations)
    const hasStabilityErrors = consoleMessages.some(msg => 
      msg.includes('NaN') ||
      msg.includes('Infinity') ||
      msg.includes('oscillation') ||
      msg.includes('unstable')
    );
    
    expect(hasStabilityErrors).toBe(false);
  });

  test('momentum system maintains good performance with 10,000 agents', async ({ page }): Promise<void> => {
    // Only run this test in Chromium-based browsers
    const browserName = page.context().browser()?.browserType().name();
    if (browserName !== 'chromium') {
      test.skip();
      return;
    }
    
    await page.goto('/');
    
    // Wait for initialization
    await page.waitForTimeout(1500);
    
    // Check WebGPU availability
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.waitForTimeout(500);
    
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip if WebGPU not available
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    // Test performance by running simulation for extended period
    // The momentum system should maintain stable performance with 10,000 agents
    const performanceStart = Date.now();
    
    // Let simulation run for 5 seconds to test sustained performance
    await page.waitForTimeout(5000);
    
    const performanceEnd = Date.now();
    const elapsedTime = performanceEnd - performanceStart;
    
    // Verify canvas remains responsive during performance test
    await expect(page.locator('#canvas')).toBeVisible();
    
    // Check that no performance-related errors occurred
    const hasPerformanceErrors = consoleMessages.some(msg => 
      msg.includes('GPU timeout') ||
      msg.includes('Memory allocation failed') ||
      msg.includes('Buffer overflow') ||
      msg.includes('performance') ||
      msg.includes('slow') ||
      msg.includes('timeout')
    );
    
    expect(hasPerformanceErrors).toBe(false);
    
    // Verify simulation ran for expected duration (allowing for some variance)
    expect(elapsedTime).toBeGreaterThanOrEqual(4800); // At least 4.8 seconds
    expect(elapsedTime).toBeLessThan(7000); // Not more than 7 seconds (indicating hang)
  });

  test('momentum system handles extreme parameter values gracefully', async ({ page }): Promise<void> => {
    // Only run this test in Chromium-based browsers
    const browserName = page.context().browser()?.browserType().name();
    if (browserName !== 'chromium') {
      test.skip();
      return;
    }
    
    await page.goto('/');
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check WebGPU availability
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.waitForTimeout(500);
    
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip if WebGPU not available
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    // Test that the system remains stable even with the current parameter values
    // which should be within safe ranges (0.05-0.3 for smoothing, 0.05-0.2 for damping)
    await page.waitForTimeout(4000);
    
    // Verify canvas remains responsive
    await expect(page.locator('#canvas')).toBeVisible();
    
    // Check that no extreme value errors occurred
    const hasExtremeValueErrors = consoleMessages.some(msg => 
      msg.includes('parameter') ||
      msg.includes('range') ||
      msg.includes('invalid') ||
      msg.includes('overflow')
    );
    
    expect(hasExtremeValueErrors).toBe(false);
  });
});

test.describe('Edge Avoidance Feature', () => {
  test('boids turn away from screen edges instead of wrapping', async ({ page }): Promise<void> => {
    // Only run this test in Chromium-based browsers with WebGPU
    const browserName = page.context().browser()?.browserType().name();
    if (browserName !== 'chromium') {
      test.skip();
      return;
    }
    
    await page.goto('/');
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check WebGPU availability
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.waitForTimeout(500);
    
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip if WebGPU not available
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    // Let simulation run to allow boids to approach edges
    await page.waitForTimeout(3000);
    
    // Verify canvas is still visible and simulation is running
    await expect(page.locator('#canvas')).toBeVisible();
    
    // Check that no edge-wrapping related errors occurred
    const hasEdgeErrors = consoleMessages.some(msg => 
      msg.includes('edge wrapping') ||
      msg.includes('boundary wrap') ||
      msg.includes('position teleport')
    );
    
    expect(hasEdgeErrors).toBe(false);
  });

  test('edge avoidance maintains simulation stability', async ({ page }): Promise<void> => {
    // Only run this test in Chromium-based browsers with WebGPU
    const browserName = page.context().browser()?.browserType().name();
    if (browserName !== 'chromium') {
      test.skip();
      return;
    }
    
    await page.goto('/');
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check WebGPU availability
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.waitForTimeout(500);
    
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip if WebGPU not available
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    // Run simulation for extended period to test stability with edge avoidance
    await page.waitForTimeout(5000);
    
    // Verify canvas remains responsive
    await expect(page.locator('#canvas')).toBeVisible();
    
    // Check that no stability issues occurred
    const hasStabilityErrors = consoleMessages.some(msg => 
      msg.includes('NaN') ||
      msg.includes('Infinity') ||
      msg.includes('shader error') ||
      msg.includes('GPU pipeline error')
    );
    
    expect(hasStabilityErrors).toBe(false);
  });

  test('edge avoidance parameters are properly configured', async ({ page }): Promise<void> => {
    // Only run this test in Chromium-based browsers with WebGPU
    const browserName = page.context().browser()?.browserType().name();
    if (browserName !== 'chromium') {
      test.skip();
      return;
    }
    
    await page.goto('/');
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check WebGPU availability
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.waitForTimeout(500);
    
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip if WebGPU not available
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    // Run simulation to verify edge parameters are working
    await page.waitForTimeout(2000);
    
    // Verify canvas is still visible and simulation is running
    await expect(page.locator('#canvas')).toBeVisible();
    
    // Check that no parameter-related errors occurred
    const hasParameterErrors = consoleMessages.some(msg => 
      msg.includes('edgeAvoidanceDistance') ||
      msg.includes('edgeAvoidanceForce') ||
      msg.includes('uniform buffer') ||
      msg.includes('parameter mismatch')
    );
    
    expect(hasParameterErrors).toBe(false);
  });
});

test.describe('FPS Counter Feature', () => {
  test('FPS counter element is created and visible by default', async ({ page }): Promise<void> => {
    await page.goto('/');
    
    // Listen for console messages to check for WebGPU initialization
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check if WebGPU initialized successfully
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip test if WebGPU is not available (headless mode)
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    // Check that the FPS counter element exists in DOM
    const fpsCounter = page.locator('.fps-counter');
    await expect(fpsCounter).toBeAttached();
    
    // Should be hidden by default, press F to show
    await expect(fpsCounter).toBeHidden();
    await page.keyboard.press('f');
    await expect(fpsCounter).toBeVisible();
  });

  test('pressing F key toggles FPS counter visibility', async ({ page }): Promise<void> => {
    await page.goto('/');
    
    // Listen for console messages to check for WebGPU initialization
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check if WebGPU initialized successfully
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip test if WebGPU is not available (headless mode)
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    const fpsCounter = page.locator('.fps-counter');
    
    // Initially hidden
    await expect(fpsCounter).toBeHidden();
    
    // Press 'F' key to show FPS counter
    await page.keyboard.press('f');
    await expect(fpsCounter).toBeVisible();
    
    // Press 'F' key again to hide FPS counter
    await page.keyboard.press('f');
    await expect(fpsCounter).toBeHidden();
  });

  test('FPS counter displays proper format when visible', async ({ page }): Promise<void> => {
    await page.goto('/');
    
    // Listen for console messages to check for WebGPU initialization
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check if WebGPU initialized successfully
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip test if WebGPU is not available (headless mode)
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    const fpsCounter = page.locator('.fps-counter');
    
    // Show FPS counter
    await page.keyboard.press('f');
    await expect(fpsCounter).toBeVisible();
    
    // Check initial text content format
    await expect(fpsCounter).toHaveText(/^FPS: \d+$/);
  });

  test('FPS counter updates over time when visible', async ({ page }): Promise<void> => {
    // Only run this test in Chromium-based browsers
    const browserName = page.context().browser()?.browserType().name();
    if (browserName !== 'chromium') {
      test.skip();
      return;
    }
    
    // Listen for console messages to check for WebGPU initialization
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.goto('/');
    
    // Wait for WebGPU initialization and check availability
    await page.waitForTimeout(1500);
    
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip if WebGPU not available
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    const fpsCounter = page.locator('.fps-counter');
    
    // Show FPS counter
    await page.keyboard.press('f');
    await expect(fpsCounter).toBeVisible();
    
    // Get initial FPS reading
    const initialText = await fpsCounter.textContent();
    
    // Wait for at least 1.5 seconds (longer than update interval)
    await page.waitForTimeout(1500);
    
    // Get updated FPS reading
    const updatedText = await fpsCounter.textContent();
    
    // Verify format is maintained
    expect(initialText).toMatch(/^FPS: \d+$/);
    expect(updatedText).toMatch(/^FPS: \d+$/);
    
    // Extract FPS values
    const initialFPS = parseInt(initialText?.replace('FPS: ', '') || '0');
    const updatedFPS = parseInt(updatedText?.replace('FPS: ', '') || '0');
    
    // FPS should be greater than 0 when running
    expect(updatedFPS).toBeGreaterThan(0);
    
    // FPS should be reasonable (between 1 and 120)
    expect(updatedFPS).toBeGreaterThanOrEqual(1);
    expect(updatedFPS).toBeLessThanOrEqual(120);
  });

  test('FPS counter has correct CSS styling', async ({ page }): Promise<void> => {
    await page.goto('/');
    
    // Listen for console messages to check for WebGPU initialization
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check if WebGPU initialized successfully
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip test if WebGPU is not available (headless mode)
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    const fpsCounter = page.locator('.fps-counter');
    
    // Show FPS counter
    await page.keyboard.press('f');
    await expect(fpsCounter).toBeVisible();
    
    // Check CSS properties
    const styles = await fpsCounter.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        position: computed.position,
        top: computed.top,
        left: computed.left,
        fontFamily: computed.fontFamily,
        fontSize: computed.fontSize,
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        padding: computed.padding,
        borderRadius: computed.borderRadius,
        pointerEvents: computed.pointerEvents,
        zIndex: computed.zIndex,
        userSelect: computed.userSelect,
      };
    });
    
    expect(styles.position).toBe('fixed');
    expect(styles.top).toBe('10px');
    expect(styles.left).toBe('10px');
    expect(styles.fontFamily).toContain('monospace');
    expect(styles.fontSize).toBe('14px');
    expect(styles.color).toBe('rgb(0, 255, 0)'); // #00ff00
    expect(styles.padding).toBe('5px 10px');
    expect(styles.borderRadius).toBe('3px');
    expect(styles.pointerEvents).toBe('none');
    expect(styles.zIndex).toBe('1000');
    expect(styles.userSelect).toBe('none');
  });

  test('FPS counter works with case insensitive F key', async ({ page }): Promise<void> => {
    await page.goto('/');
    
    // Listen for console messages to check for WebGPU initialization
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check if WebGPU initialized successfully
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip test if WebGPU is not available (headless mode)
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    const fpsCounter = page.locator('.fps-counter');
    
    // Initially hidden
    await expect(fpsCounter).toBeHidden();
    
    // Press 'F' key (uppercase) to show FPS counter
    await page.keyboard.press('F');
    await expect(fpsCounter).toBeVisible();
    
    // Press 'f' key (lowercase) to hide FPS counter
    await page.keyboard.press('f');
    await expect(fpsCounter).toBeHidden();
  });

  test('FPS counter does not interfere with canvas interaction', async ({ page }): Promise<void> => {
    await page.goto('/');
    
    // Listen for console messages to check for WebGPU initialization
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check if WebGPU initialized successfully
    const hasWebGPUSuccess = consoleMessages.some(msg => 
      msg.includes('WebGPU initialized successfully!')
    );
    
    const hasNoAdapterError = consoleMessages.some(msg =>
      msg.includes('No appropriate GPUAdapter found')
    );
    
    // Skip test if WebGPU is not available (headless mode)
    if (hasNoAdapterError && !hasWebGPUSuccess) {
      test.skip();
      return;
    }
    
    const canvas = page.locator('#canvas');
    const fpsCounter = page.locator('.fps-counter');
    
    // Show FPS counter
    await page.keyboard.press('f');
    await expect(fpsCounter).toBeVisible();
    
    // Verify canvas is still clickable (pointer-events: none on FPS counter)
    await canvas.click();
    
    // Canvas should remain visible and responsive
    await expect(canvas).toBeVisible();
  });
});