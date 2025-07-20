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
});