import { test } from '@playwright/test';
import { TEST_CREDENTIALS } from './fixtures/auth';
import { authenticateTestUser, setupFirebaseEmulators } from './helpers/auth';

test.describe('Sticky Toolbar Diagnostics', () => {
  // Skip these tests in CI unless emulators are configured
  test.skip(!process.env.VITE_USE_FIREBASE_EMULATORS, 'Requires Firebase emulators');

  test.beforeEach(async ({ page }) => {
    // Setup Firebase emulators
    await setupFirebaseEmulators(page);

    // Authenticate as a test user
    const producer = TEST_CREDENTIALS.producer;
    await authenticateTestUser(page, {
      email: producer.email,
      password: producer.password,
      role: producer.role,
      clientId: 'test-client'
    });
  });

  test('diagnose sticky toolbar positioning', async ({ page }) => {
    // Navigate to the shots page
    await page.goto('/shots');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Extra wait for any animations and measurements

  // Get all the relevant elements
  const measurements = await page.evaluate(() => {
    const nav = document.querySelector('[data-app-top-nav]');
    const breadcrumb = document.querySelector('[data-app-breadcrumb]');
    const shotHeader = document.querySelector('[data-shot-overview-header]');
    const stickyToolbar = document.querySelector('.sticky.z-\\[38\\]');
    const firstCard = document.querySelector('[data-shot-card]') || document.querySelector('.grid > div:first-child');

    const getElementInfo = (element, name) => {
      if (!element) return { name, exists: false };

      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);

      return {
        name,
        exists: true,
        rect: {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          width: rect.width,
        },
        offsetHeight: element.offsetHeight,
        position: style.position,
        top: style.top,
        zIndex: style.zIndex,
      };
    };

    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollY: window.scrollY,
      },
      nav: getElementInfo(nav, 'Navigation Bar'),
      breadcrumb: getElementInfo(breadcrumb, 'Breadcrumb'),
      shotHeader: getElementInfo(shotHeader, 'Shot Overview Header'),
      stickyToolbar: getElementInfo(stickyToolbar, 'Sticky Toolbar'),
      firstCard: getElementInfo(firstCard, 'First Shot Card'),

      // Calculate expected vs actual positioning
      calculated: {
        navBottom: nav ? nav.getBoundingClientRect().bottom : 0,
        breadcrumbBottom: breadcrumb ? breadcrumb.getBoundingClientRect().bottom : 0,
        shotHeaderBottom: shotHeader ? shotHeader.getBoundingClientRect().bottom : 0,
      }
    };
  });

  // Log all measurements
  console.log('\n=== STICKY TOOLBAR DIAGNOSIS ===\n');
  console.log('Viewport:', JSON.stringify(measurements.viewport, null, 2));
  console.log('\nNavigation Bar:', JSON.stringify(measurements.nav, null, 2));
  console.log('\nBreadcrumb:', JSON.stringify(measurements.breadcrumb, null, 2));
  console.log('\nShot Overview Header:', JSON.stringify(measurements.shotHeader, null, 2));
  console.log('\nSticky Toolbar:', JSON.stringify(measurements.stickyToolbar, null, 2));
  console.log('\nFirst Shot Card:', JSON.stringify(measurements.firstCard, null, 2));

  console.log('\n=== CALCULATED POSITIONS ===');
  console.log('Nav bottom:', measurements.calculated.navBottom);
  console.log('Breadcrumb bottom:', measurements.calculated.breadcrumbBottom);
  console.log('Shot header bottom:', measurements.calculated.shotHeaderBottom);

  if (measurements.stickyToolbar.exists && measurements.firstCard.exists) {
    const gap = measurements.firstCard.rect.top - measurements.stickyToolbar.rect.bottom;
    console.log('\n=== GAP ANALYSIS ===');
    console.log('Sticky toolbar bottom:', measurements.stickyToolbar.rect.bottom);
    console.log('First card top:', measurements.firstCard.rect.top);
    console.log('Gap between toolbar and first card:', gap);

    if (gap < 0) {
      console.log('\n⚠️  OVERLAP DETECTED! Cards are', Math.abs(gap), 'px behind the toolbar');
    } else {
      console.log('\n✓ No overlap. Gap is', gap, 'px');
    }
  }

  // Take a screenshot showing the issue
  await page.screenshot({
    path: 'sticky-diagnosis-fullpage.png',
    fullPage: false
  });

  console.log('\nScreenshot saved to: sticky-diagnosis-fullpage.png');

  // Highlight all elements with colored borders for visual debugging
  await page.evaluate(() => {
    const nav = document.querySelector('[data-app-top-nav]');
    const breadcrumb = document.querySelector('[data-app-breadcrumb]');
    const shotHeader = document.querySelector('[data-shot-overview-header]');
    const stickyToolbar = document.querySelector('.sticky.z-\\[38\\]');

    if (nav) {
      nav.style.outline = '3px solid red';
      nav.style.outlineOffset = '-3px';
    }
    if (breadcrumb) {
      breadcrumb.style.outline = '3px solid orange';
      breadcrumb.style.outlineOffset = '-3px';
    }
    if (shotHeader) {
      shotHeader.style.outline = '3px solid yellow';
      shotHeader.style.outlineOffset = '-3px';
    }
    if (stickyToolbar) {
      stickyToolbar.style.outline = '3px solid lime';
      stickyToolbar.style.outlineOffset = '-3px';
    }
  });

  await page.screenshot({
    path: 'sticky-diagnosis-highlighted.png',
    fullPage: false
  });

    console.log('Highlighted screenshot saved to: sticky-diagnosis-highlighted.png');
  });
});
