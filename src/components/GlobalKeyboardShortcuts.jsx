/**
 * GlobalKeyboardShortcuts - Global keyboard shortcut handler
 *
 * Provides app-wide keyboard shortcuts using react-hotkeys-hook
 * Includes inline KeyboardShortcutsHelp modal
 *
 * Shortcuts:
 * - Shift+/: Show keyboard shortcuts help
 * - Alt+D: Go to Dashboard
 * - Alt+S: Go to Shots (with project check)
 * - Alt+P: Go to Products
 * - Alt+T: Go to Talent
 * - Alt+L: Go to Locations
 * - Alt+U: Go to Pulls
 * - c: Open command palette (when not in form)
 */

import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { X, Command, Navigation, Zap } from 'lucide-react';
import { useProjectScope } from '../context/ProjectScopeContext';
import { useSearchCommand } from '../context/SearchCommandContext';
import { toast } from '../lib/toast';

// Keyboard shortcut definitions grouped by category
const SHORTCUTS = {
  general: [
    { keys: ['⌘', 'K'], action: 'Open command palette', mac: 'Cmd+K', win: 'Ctrl+K' },
    { keys: ['Shift', '?'], action: 'Show keyboard shortcuts', mac: 'Shift+/', win: 'Shift+/' },
    { keys: ['C'], action: 'Open command palette', mac: 'C', win: 'C' },
  ],
  navigation: [
    { keys: ['Alt', 'D'], action: 'Go to Dashboard', mac: 'Alt+D', win: 'Alt+D' },
    { keys: ['Alt', 'S'], action: 'Go to Shots', mac: 'Alt+S', win: 'Alt+S' },
    { keys: ['Alt', 'P'], action: 'Go to Products', mac: 'Alt+P', win: 'Alt+P' },
    { keys: ['Alt', 'T'], action: 'Go to Talent', mac: 'Alt+T', win: 'Alt+T' },
    { keys: ['Alt', 'L'], action: 'Go to Locations', mac: 'Alt+L', win: 'Alt+L' },
    { keys: ['Alt', 'U'], action: 'Go to Pulls', mac: 'Alt+U', win: 'Alt+U' },
  ],
};

/**
 * KeyboardShortcutsHelp Modal Component
 */
function KeyboardShortcutsHelp({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1001] flex items-start justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm animate-fade-in pt-[10vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl animate-slide-in-from-top"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <h2 id="shortcuts-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition"
            aria-label="Close keyboard shortcuts"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* General Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Command className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                General
              </h3>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.general.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {shortcut.action}
                  </span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <React.Fragment key={i}>
                        <kbd className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded shadow-sm">
                          {key}
                        </kbd>
                        {i < shortcut.keys.length - 1 && (
                          <span className="text-slate-400 dark:text-slate-500 text-xs mx-1">+</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Navigation className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                Navigation
              </h3>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.navigation.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {shortcut.action}
                  </span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <React.Fragment key={i}>
                        <kbd className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded shadow-sm">
                          {key}
                        </kbd>
                        {i < shortcut.keys.length - 1 && (
                          <span className="text-slate-400 dark:text-slate-500 text-xs mx-1">+</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-900/50">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Press <kbd className="inline-flex items-center px-2 py-0.5 text-xs font-mono bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded">Shift+/</kbd> anytime to toggle this dialog
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * GlobalKeyboardShortcuts Component
 */
export default function GlobalKeyboardShortcuts() {
  const navigate = useNavigate();
  const { currentProjectId } = useProjectScope();
  const { openSearch } = useSearchCommand();
  const [showHelp, setShowHelp] = useState(false);

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

  // Toggle help modal
  const toggleHelp = useCallback(() => {
    setShowHelp(prev => !prev);
  }, []);

  // Close help modal
  const closeHelp = useCallback(() => {
    setShowHelp(false);
  }, []);

  // Register keyboard shortcuts

  // Help Modal (works everywhere including forms)
  // Note: Shift+/ produces '?' on most keyboards, so we listen for '?' with useKey: true
  useHotkeys('?', toggleHelp, {
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

  // Close help on Escape
  useHotkeys('escape', closeHelp, {
    enabled: showHelp,
    enableOnFormTags: true,
  });

  return (
    <>
      {/* Render help modal */}
      <KeyboardShortcutsHelp isOpen={showHelp} onClose={closeHelp} />
    </>
  );
}
