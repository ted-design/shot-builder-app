/**
 * GlobalKeyboardShortcuts - Global keyboard shortcut handler
 *
 * Provides app-wide keyboard shortcuts using react-hotkeys-hook
 * Keyboard shortcuts are now displayed in the Command K palette
 *
 * Shortcuts:
 * - Shift+/: Show keyboard shortcuts in Command K
 * - Alt+D: Go to Dashboard
 * - Alt+S: Go to Shots (with project check)
 * - Alt+P: Go to Products
 * - Alt+T: Go to Talent
 * - Alt+L: Go to Locations
 * - Alt+U: Go to Pulls
 * - c: Open command palette (when not in form)
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { useProjectScope } from '../context/ProjectScopeContext';
import { useSearchCommand } from '../context/SearchCommandContext';
import { toast } from '../lib/toast';


/**
 * GlobalKeyboardShortcuts Component
 */
export default function GlobalKeyboardShortcuts() {
  const navigate = useNavigate();
  const { currentProjectId } = useProjectScope();
  const { openSearch, openSearchForShortcuts } = useSearchCommand();

  // Navigation handlers with context awareness
  const navigateToShots = useCallback(() => {
    if (!currentProjectId) {
      toast.info({
        title: 'Please select a project first',
        description: 'Shots require an active project context'
      });
      navigate('/projects');
    } else {
      navigate(`/projects/${currentProjectId}/shots`);
    }
  }, [currentProjectId, navigate]);

  const navigateToDashboard = useCallback(() => {
    navigate('/projects');
  }, [navigate]);

  const navigateToProducts = useCallback(() => {
    navigate('/products');
  }, [navigate]);

  const navigateToTalent = useCallback(() => {
    navigate('/talent');
  }, [navigate]);

  const navigateToLocations = useCallback(() => {
    navigate('/locations');
  }, [navigate]);

  const navigateToPulls = useCallback(() => {
    navigate('/pulls');
  }, [navigate]);

  // Register keyboard shortcuts

  // Show keyboard shortcuts in Command K (works everywhere including forms)
  // Note: Shift+/ produces '?' on most keyboards, so we listen for '?' with useKey: true
  useHotkeys('?', openSearchForShortcuts, {
    enableOnFormTags: true,
    preventDefault: true,
    useKey: true, // Listen for the actual character produced, not the key code
  });

  // Navigation shortcuts (work everywhere including forms)
  useHotkeys('alt+d', navigateToDashboard, {
    enableOnFormTags: true,
    preventDefault: true,
  });

  useHotkeys('alt+s', navigateToShots, {
    enableOnFormTags: true,
    preventDefault: true,
  });

  useHotkeys('alt+p', navigateToProducts, {
    enableOnFormTags: true,
    preventDefault: true,
  });

  useHotkeys('alt+t', navigateToTalent, {
    enableOnFormTags: true,
    preventDefault: true,
  });

  useHotkeys('alt+l', navigateToLocations, {
    enableOnFormTags: true,
    preventDefault: true,
  });

  useHotkeys('alt+u', navigateToPulls, {
    enableOnFormTags: true,
    preventDefault: true,
  });

  // Single-key shortcuts (NOT in forms to avoid conflicts with typing)
  useHotkeys('c', openSearch, {
    enableOnFormTags: false, // Don't trigger when typing in forms
    preventDefault: true,
  });

  return null;
}
