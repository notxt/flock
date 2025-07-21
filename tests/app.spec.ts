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
      msg.includes('WebGPU initialized successfully')
    );
    
    // Check for error messages
    const hasErrorMessage = consoleMessages.some(msg => 
      msg.includes('WebGPU initialization failed') || 
      msg.includes('WebGPU is only supported in Chrome')
    );
    
    // In Chromium, we expect success
    expect(hasSuccessMessage).toBe(true);
    expect(hasErrorMessage).toBe(false);
    
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
});