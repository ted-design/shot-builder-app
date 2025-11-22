import React from 'react';
import { Home, Package, Users, MapPin } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Breadcrumb from '../../components/ui/Breadcrumb';
import { Button } from '../../components/ui/button';
import { useTheme } from '../../context/ThemeContext';

/**
 * Test page for PageHeader component - Phase 2 Design System Implementation
 *
 * Tests:
 * - PageHeader with breadcrumbs
 * - PageHeader with title only
 * - PageHeader with title + description
 * - PageHeader with title + actions
 * - PageHeader with all elements
 * - Sticky behavior on scroll
 * - Responsive layout
 * - Light/dark theme compatibility
 */
export default function PageHeaderTest() {
  const { theme, resolvedTheme, toggleTheme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Test: Full PageHeader with all elements */}
      <PageHeader sticky={true}>
        <Breadcrumb
          items={[
            { label: 'Home', href: '/', icon: Home },
            { label: 'Projects', href: '/projects', icon: Package },
            { label: 'Current Project' },
          ]}
        />
        <PageHeader.Content>
          <PageHeader.Title>Page Header Component</PageHeader.Title>
          <PageHeader.Actions>
            <Button variant="outline" size="sm" onClick={toggleTheme}>
              Toggle Theme ({resolvedTheme})
            </Button>
            <Button size="sm">Create New</Button>
          </PageHeader.Actions>
        </PageHeader.Content>
        <PageHeader.Description>
          This is a comprehensive test page for the PageHeader component. Scroll down to see
          the sticky behavior in action. The header uses design tokens from Phase 1 and
          provides a consistent layout across all pages.
        </PageHeader.Description>
      </PageHeader>

      {/* Content area to test sticky scroll */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        {/* Variation 1: Title + Actions only */}
        <section className="space-y-4">
          <h2 className="heading-section">Variation 1: Title + Actions</h2>
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-card overflow-hidden">
            <PageHeader sticky={false}>
              <PageHeader.Content>
                <PageHeader.Title>Product Catalog</PageHeader.Title>
                <PageHeader.Actions>
                  <Button variant="outline" size="sm">Export</Button>
                  <Button size="sm">Add Product</Button>
                </PageHeader.Actions>
              </PageHeader.Content>
            </PageHeader>
            <div className="p-6 body-text">
              This header has a title and action buttons. It's non-sticky for demo purposes.
            </div>
          </div>
        </section>

        {/* Variation 2: Title + Description only */}
        <section className="space-y-4">
          <h2 className="heading-section">Variation 2: Title + Description</h2>
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-card overflow-hidden">
            <PageHeader sticky={false}>
              <PageHeader.Content>
                <PageHeader.Title>Talent Directory</PageHeader.Title>
              </PageHeader.Content>
              <PageHeader.Description>
                Browse and manage your talent roster. View model profiles, measurements, and
                availability for upcoming shoots.
              </PageHeader.Description>
            </PageHeader>
            <div className="p-6 body-text">
              This header emphasizes the description to provide context about the page.
            </div>
          </div>
        </section>

        {/* Variation 3: Breadcrumbs + Title + Actions */}
        <section className="space-y-4">
          <h2 className="heading-section">Variation 3: Complete Navigation</h2>
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-card overflow-hidden">
            <PageHeader sticky={false}>
              <Breadcrumb
                items={[
                  { label: 'Dashboard', href: '/', icon: Home },
                  { label: 'Locations', href: '/locations', icon: MapPin },
                  { label: 'Location Details' },
                ]}
              />
              <PageHeader.Content>
                <PageHeader.Title>Studio A</PageHeader.Title>
                <PageHeader.Actions>
                  <Button variant="outline" size="sm">Edit</Button>
                  <Button variant="danger" size="sm">Delete</Button>
                </PageHeader.Actions>
              </PageHeader.Content>
              <PageHeader.Description>
                Professional photography studio in downtown. Equipped with natural light,
                backdrops, and props.
              </PageHeader.Description>
            </PageHeader>
            <div className="p-6 body-text">
              This is the full treatment: breadcrumbs for navigation context, title, actions,
              and description.
            </div>
          </div>
        </section>

        {/* Variation 4: Minimal - Title only */}
        <section className="space-y-4">
          <h2 className="heading-section">Variation 4: Minimal</h2>
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-card overflow-hidden">
            <PageHeader sticky={false}>
              <PageHeader.Content>
                <PageHeader.Title>Simple Page</PageHeader.Title>
              </PageHeader.Content>
            </PageHeader>
            <div className="p-6 body-text">
              Sometimes less is more. This header only has a title.
            </div>
          </div>
        </section>

        {/* Test: Design Token Usage */}
        <section className="space-y-4">
          <h2 className="heading-section">Design Token Verification</h2>
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-card p-6 space-y-4">
            <div>
              <h3 className="heading-subsection">Typography Tokens</h3>
              <ul className="space-y-2 mt-2 body-text">
                <li>
                  <code className="text-xs bg-neutral-100 dark:bg-neutral-900 px-2 py-1 rounded">
                    .heading-page
                  </code>{' '}
                  - Used in PageHeader.Title
                </li>
                <li>
                  <code className="text-xs bg-neutral-100 dark:bg-neutral-900 px-2 py-1 rounded">
                    .body-text-muted
                  </code>{' '}
                  - Used in PageHeader.Description
                </li>
              </ul>
            </div>
            <div>
              <h3 className="heading-subsection">Spacing Tokens</h3>
              <ul className="space-y-2 mt-2 body-text">
                <li>
                  <code className="text-xs bg-neutral-100 dark:bg-neutral-900 px-2 py-1 rounded">
                    .content-padding
                  </code>{' '}
                  - px-6 py-4 (used in PageHeader)
                </li>
              </ul>
            </div>
            <div>
              <h3 className="heading-subsection">Color Tokens</h3>
              <ul className="space-y-2 mt-2 body-text">
                <li>
                  <code className="text-xs bg-neutral-100 dark:bg-neutral-900 px-2 py-1 rounded">
                    neutral-*
                  </code>{' '}
                  - All backgrounds, borders, and text use neutral scale
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Scroll Content */}
        <section className="space-y-4">
          <h2 className="heading-section">Scroll Test Content</h2>
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-card p-6">
            <p className="body-text mb-4">
              Scroll to the top to verify the sticky header behavior. The header should remain
              fixed at the top with a backdrop blur effect.
            </p>
            {[...Array(20)].map((_, i) => (
              <p key={i} className="body-text mb-4">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                nostrud exercitation ullamco laboris.
              </p>
            ))}
          </div>
        </section>

        {/* Testing Checklist */}
        <section className="space-y-4">
          <h2 className="heading-section">Phase 2 Testing Checklist</h2>
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-card p-6">
            <h3 className="heading-subsection mb-4">Manual Testing</h3>
            <ul className="space-y-2 body-text">
              <li>✅ PageHeader created with compound pattern</li>
              <li>⏳ Sticky header works on scroll</li>
              <li>⏳ Backdrop blur visible when scrolling</li>
              <li>⏳ Breadcrumbs integrate correctly</li>
              <li>⏳ Title uses .heading-page token</li>
              <li>⏳ Description uses .body-text-muted token</li>
              <li>⏳ Actions align right on desktop</li>
              <li>⏳ Layout stacks on mobile</li>
              <li>⏳ Theme toggle works (light/dark/system)</li>
              <li>⏳ Border uses neutral-200/700</li>
            </ul>

            <h3 className="heading-subsection mt-6 mb-4">Playwright Testing</h3>
            <ul className="space-y-2 body-text">
              <li>⏳ Screenshot: Light mode - full header</li>
              <li>⏳ Screenshot: Dark mode - full header</li>
              <li>⏳ Screenshot: Mobile viewport (375px)</li>
              <li>⏳ Screenshot: Desktop viewport (1920px)</li>
              <li>⏳ Test: Click action buttons</li>
              <li>⏳ Test: Click breadcrumb links</li>
              <li>⏳ Test: Scroll to verify sticky</li>
            </ul>

            <h3 className="heading-subsection mt-6 mb-4">Accessibility (Chrome DevTools)</h3>
            <ul className="space-y-2 body-text">
              <li>⏳ Verify h1 is present</li>
              <li>⏳ Check heading hierarchy</li>
              <li>⏳ Verify ARIA labels</li>
              <li>⏳ Test keyboard navigation</li>
              <li>⏳ Check focus indicators</li>
              <li>⏳ Verify color contrast (WCAG AA)</li>
            </ul>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setTheme('system')}>
                Use System Theme (currently: {theme})
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
