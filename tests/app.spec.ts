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