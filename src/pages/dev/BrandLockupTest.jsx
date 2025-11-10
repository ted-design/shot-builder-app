import React from 'react';
import { BrandLockup } from '../../components/common/BrandLockup';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui/button';

/**
 * BrandLockupTest - Development page for testing BrandLockup component
 * Temporary page for Phase 1 testing. Can be removed after integration.
 */
export function BrandLockupTest() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="heading-page">BrandLockup Component Test</h1>
          <p className="body-text-muted">
            Testing the co-branded logo component in light and dark modes
          </p>

          {/* Theme Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className="body-text">Current theme: <strong>{theme}</strong></span>
            <Button onClick={toggleTheme} variant="outline">
              Toggle Theme
            </Button>
          </div>
        </div>

        {/* Test Cases */}
        <div className="space-y-8">
          {/* Small Size */}
          <div className="card-padding rounded-card bg-neutral-50 dark:bg-neutral-800 space-y-4">
            <h2 className="heading-subsection">Small Size (sm)</h2>
            <div className="flex items-center gap-4">
              <BrandLockup size="sm" />
              <span className="caption">20px mobile → 24px desktop</span>
            </div>
          </div>

          {/* Medium Size (Default) */}
          <div className="card-padding rounded-card bg-neutral-50 dark:bg-neutral-800 space-y-4">
            <h2 className="heading-subsection">Medium Size (md) - Default</h2>
            <div className="flex items-center gap-4">
              <BrandLockup size="md" />
              <span className="caption">24px mobile → 32px desktop</span>
            </div>
          </div>

          {/* Large Size */}
          <div className="card-padding rounded-card bg-neutral-50 dark:bg-neutral-800 space-y-4">
            <h2 className="heading-subsection">Large Size (lg)</h2>
            <div className="flex items-center gap-4">
              <BrandLockup size="lg" />
              <span className="caption">32px mobile → 40px desktop</span>
            </div>
          </div>

          {/* In Header Context */}
          <div className="card-padding rounded-card bg-neutral-50 dark:bg-neutral-800 space-y-4">
            <h2 className="heading-subsection">In Header Context</h2>
            <div className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-card">
              <div className="flex items-center gap-4">
                <button className="text-neutral-600 dark:text-neutral-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <BrandLockup size="md" />
              </div>
              <div className="flex items-center gap-2">
                <span className="caption">Header Actions →</span>
              </div>
            </div>
          </div>

          {/* Typography Tokens Test */}
          <div className="card-padding rounded-card bg-neutral-50 dark:bg-neutral-800 space-y-4">
            <h2 className="heading-subsection">Design Token Typography Test</h2>
            <div className="space-y-2">
              <div className="heading-page">Page Heading (heading-page)</div>
              <div className="heading-section">Section Heading (heading-section)</div>
              <div className="heading-subsection">Subsection Heading (heading-subsection)</div>
              <p className="body-text">Body text (body-text)</p>
              <p className="body-text-muted">Muted body text (body-text-muted)</p>
              <span className="caption">Caption text (caption)</span>
              <label className="label">Label text (label)</label>
            </div>
          </div>

          {/* Color Tokens Test */}
          <div className="card-padding rounded-card bg-neutral-50 dark:bg-neutral-800 space-y-4">
            <h2 className="heading-subsection">Design Token Colors Test</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center space-y-2">
                <div className="h-12 bg-immediate-red rounded"></div>
                <span className="caption">immediate-red</span>
              </div>
              <div className="text-center space-y-2">
                <div className="h-12 bg-primary rounded"></div>
                <span className="caption">primary</span>
              </div>
              <div className="text-center space-y-2">
                <div className="h-12 bg-secondary rounded"></div>
                <span className="caption">secondary</span>
              </div>
              <div className="text-center space-y-2">
                <div className="h-12 bg-warning rounded"></div>
                <span className="caption">warning</span>
              </div>
              <div className="text-center space-y-2">
                <div className="h-12 bg-danger rounded"></div>
                <span className="caption">danger</span>
              </div>
              <div className="text-center space-y-2">
                <div className="h-12 bg-neutral-500 rounded"></div>
                <span className="caption">neutral-500</span>
              </div>
              <div className="text-center space-y-2">
                <div className="h-12 bg-surface dark:bg-surface-dark rounded border border-neutral-200 dark:border-neutral-700"></div>
                <span className="caption">surface</span>
              </div>
              <div className="text-center space-y-2">
                <div className="h-12 bg-muted dark:bg-muted-dark rounded"></div>
                <span className="caption">muted</span>
              </div>
            </div>
          </div>
        </div>

        {/* Testing Instructions */}
        <div className="card-padding rounded-card bg-primary/10 border border-primary space-y-2">
          <h3 className="heading-subsection">Testing Checklist</h3>
          <ul className="body-text space-y-1 list-disc list-inside">
            <li>✓ BrandLockup displays both logos</li>
            <li>✓ Logos switch correctly when toggling theme</li>
            <li>✓ All three sizes (sm, md, lg) render correctly</li>
            <li>✓ Separator line is visible and properly colored</li>
            <li>✓ Typography tokens apply correct styles</li>
            <li>✓ Color tokens work in both light and dark modes</li>
            <li>✓ Component is accessible (check with screen reader)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default BrandLockupTest;
