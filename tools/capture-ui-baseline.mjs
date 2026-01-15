#!/usr/bin/env node
/**
 * UI Baseline Screenshot Capture Script
 *
 * Captures deterministic screenshots for UI parity comparison work.
 * Uses Playwright with a fixed viewport and disabled animations.
 *
 * Usage:
 *   SETHERO_URL="https://..." MYAPP_URL="http://..." npm run ui:snap
 *
 * With auth bypass (for capturing authenticated pages):
 *   npm run ui:snap:auth
 *   # or manually:
 *   VITE_PLAYWRIGHT_AUTH_BYPASS=true MYAPP_URL="http://..." npm run ui:snap
 *
 * Output:
 *   - docs/ui/sethero.png
 *   - docs/ui/myapp.png
 */

import { chromium } from 'playwright';
import { mkdir, stat } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

// Configuration
const CONFIG = {
  viewport: { width: 1440, height: 900 },
  outputDir: resolve(PROJECT_ROOT, 'docs/ui'),
  stableDelay: 1000, // ms to wait after network idle
  timeout: 60000, // 60s timeout for navigation
  authTimeout: 10000, // 10s timeout for auth bypass to kick in
};

// CSS to disable all animations and transitions
const DISABLE_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation: none !important;
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition: none !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
`;

// Selectors that indicate authenticated app content (not login page)
const APP_CONTENT_SELECTORS = [
  // Call sheet builder specific
  '[data-testid="call-sheet-builder"]',
  '[data-testid="schedule-preview"]',
  // Generic authenticated app content
  '[data-testid="sidebar-layout"]',
  '[data-testid="main-content"]',
  // Fallback: look for the sidebar nav which only appears when authenticated
  'nav[class*="sidebar"]',
  '[class*="SidebarLayout"]',
  // Project page content
  '[data-testid="projects-page"]',
  // Any schedule/call sheet content
  '[class*="SchedulePreview"]',
  '[class*="CallSheet"]',
];

// Selectors that indicate we're on a login page
const LOGIN_PAGE_SELECTORS = [
  '[data-testid="login-page"]',
  'form[action*="login"]',
  'input[type="password"]',
  'button[type="submit"]:has-text("Sign in")',
  'button[type="submit"]:has-text("Log in")',
];

/**
 * Check if Playwright auth bypass is enabled
 */
function isAuthBypassEnabled() {
  const bypassEnv = process.env.VITE_PLAYWRIGHT_AUTH_BYPASS;
  if (!bypassEnv) return false;
  const normalized = String(bypassEnv).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

/**
 * Wait for authenticated content to appear
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>} true if authenticated content found
 */
async function waitForAuthenticatedContent(page) {
  try {
    // Try to find any of the authenticated content selectors
    await page.waitForSelector(APP_CONTENT_SELECTORS.join(', '), {
      timeout: CONFIG.authTimeout,
      state: 'visible',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if page appears to be a login page
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>}
 */
async function isLoginPage(page) {
  const pageTitle = await page.title();
  const pageUrl = page.url();

  // Check URL/title for login indicators
  const loginIndicators = ['login', 'sign in', 'signin', 'auth', 'authenticate'];
  const urlTitleMatch = loginIndicators.some(
    (indicator) =>
      pageTitle.toLowerCase().includes(indicator) ||
      pageUrl.toLowerCase().includes(indicator)
  );

  if (urlTitleMatch) return true;

  // Check for login page DOM elements
  for (const selector of LOGIN_PAGE_SELECTORS) {
    try {
      const element = await page.$(selector);
      if (element) return true;
    } catch {
      // Selector not found, continue
    }
  }

  return false;
}

/**
 * Captures a screenshot of a URL
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {string} name - Screenshot name (without extension)
 * @param {string} url - URL to capture
 * @param {object} options - Capture options
 * @returns {Promise<{path: string, size: number, warning?: string}>}
 */
async function snap(page, name, url, options = {}) {
  const { requireAuth = false } = options;
  const outputPath = resolve(CONFIG.outputDir, `${name}.png`);

  console.log(`\n📸 Capturing: ${name}`);
  console.log(`   URL: ${url}`);
  if (requireAuth) {
    console.log(`   Auth: Playwright bypass enabled`);
  }

  try {
    // Navigate and wait for network idle
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: CONFIG.timeout,
    });

    // If auth is required, wait for authenticated content
    if (requireAuth) {
      console.log(`   Waiting for authenticated content...`);
      const hasAuthContent = await waitForAuthenticatedContent(page);

      if (!hasAuthContent) {
        // Check if we're stuck on login page
        const onLoginPage = await isLoginPage(page);
        if (onLoginPage) {
          throw new Error(
            `Auth bypass failed: Still showing login page. ` +
            `Make sure the dev server is running with VITE_PLAYWRIGHT_AUTH_BYPASS=true`
          );
        }
        console.log(`   ⚠️  Could not detect authenticated content selectors, but not on login page. Proceeding...`);
      } else {
        console.log(`   ✓ Authenticated content detected`);
      }
    }

    // Inject CSS to disable animations
    await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });

    // Wait for stability
    await page.waitForTimeout(CONFIG.stableDelay);

    // Final login page check (for non-auth captures or as safety check)
    const isLogin = await isLoginPage(page);
    let warning = null;

    if (isLogin) {
      if (requireAuth) {
        throw new Error(
          `Auth bypass failed: Page is showing login after waiting. ` +
          `Ensure dev server has VITE_PLAYWRIGHT_AUTH_BYPASS=true set.`
        );
      }
      warning = `⚠️  WARNING: This appears to be a login/auth page. You may need to use auth bypass or authenticate first.`;
      console.log(`   ${warning}`);
    }

    // Capture viewport screenshot (not full page)
    await page.screenshot({
      path: outputPath,
      fullPage: false,
    });

    // Get file size
    const stats = await stat(outputPath);
    const sizeKB = Math.round(stats.size / 1024);

    console.log(`   ✅ Saved: ${outputPath} (${sizeKB} KB)`);

    return { path: outputPath, size: stats.size, sizeKB, warning };
  } catch (error) {
    console.error(`   ❌ Failed to capture ${name}: ${error.message}`);
    throw error;
  }
}

/**
 * Main entry point
 */
async function main() {
  // Read URLs from environment variables
  const setheroUrl = process.env.SETHERO_URL;
  const myappUrl = process.env.MYAPP_URL;
  const authBypassEnabled = isAuthBypassEnabled();

  // Determine which captures to run
  const captureSethero = !!setheroUrl;
  const captureMyapp = !!myappUrl;

  // Validate we have at least one URL
  if (!captureSethero && !captureMyapp) {
    console.error(`
❌ Missing required environment variables.

Usage:
  SETHERO_URL="<url>" MYAPP_URL="<url>" npm run ui:snap

Example (both):
  SETHERO_URL="https://my.sethero.com/portal/12345/callsheet/67890/build/outline" \\
  MYAPP_URL="http://localhost:5173/projects/abc123/schedule?scheduleId=xyz789" \\
  npm run ui:snap

Example (my app only with auth bypass):
  MYAPP_URL="http://localhost:5173/projects/abc123/schedule" \\
  npm run ui:snap:auth

Environment Variables:
  SETHERO_URL                 - The SetHero call sheet editor URL to capture (optional)
  MYAPP_URL                   - Your app's call sheet builder URL to capture
  VITE_PLAYWRIGHT_AUTH_BYPASS - Set to "true" to enable auth bypass for my app
`);
    process.exit(1);
  }

  console.log('🎯 UI Baseline Screenshot Capture');
  console.log('═'.repeat(50));
  console.log(`Viewport: ${CONFIG.viewport.width}x${CONFIG.viewport.height}`);
  console.log(`Output: ${CONFIG.outputDir}`);
  if (authBypassEnabled) {
    console.log(`Auth Bypass: ENABLED (Playwright mode)`);
  }

  // Ensure output directory exists
  await mkdir(CONFIG.outputDir, { recursive: true });

  let browser;
  try {
    // Launch browser
    console.log('\n🚀 Launching browser...');
    browser = await chromium.launch({
      headless: true,
    });

    // Create context with fixed viewport
    const context = await browser.newContext({
      viewport: CONFIG.viewport,
      deviceScaleFactor: 1,
      // Disable various prompts and dialogs
      permissions: [],
      geolocation: undefined,
    });

    const page = await context.newPage();

    // Capture screenshots
    const results = [];

    // Capture SetHero (if URL provided)
    if (captureSethero) {
      const setheroResult = await snap(page, 'sethero', setheroUrl);
      results.push({ name: 'sethero', ...setheroResult });
    }

    // Capture My App (if URL provided)
    if (captureMyapp) {
      const myappResult = await snap(page, 'myapp', myappUrl, {
        requireAuth: authBypassEnabled,
      });
      results.push({ name: 'myapp', ...myappResult });
    }

    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('📊 Summary');
    console.log('═'.repeat(50));

    let hasWarnings = false;
    for (const result of results) {
      console.log(`  ${result.name}.png: ${result.sizeKB} KB`);
      if (result.warning) {
        hasWarnings = true;
      }
    }

    if (hasWarnings) {
      console.log('\n⚠️  One or more captures may show a login page.');
      console.log('   Try running with auth bypass: npm run ui:snap:auth');
    }

    console.log('\n✅ Done! Screenshots saved to docs/ui/');

    return results;
  } catch (error) {
    console.error('\n❌ Screenshot capture failed:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
