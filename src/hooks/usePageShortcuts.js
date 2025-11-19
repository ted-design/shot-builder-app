import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook that returns page-specific keyboard shortcuts based on current route
 * @returns {Object} { title: string, shortcuts: Array<{ keys: string[], description: string }> }
 */
export function usePageShortcuts() {
  const location = useLocation();

  const pageShortcuts = useMemo(() => {
    const pathname = location.pathname;

    // Planner page shortcuts
    if (pathname.includes('/planner')) {
      return {
        title: 'Planner Shortcuts',
        shortcuts: [
          {
            keys: ['↑', '↓'],
            description: 'Move shot within lane',
          },
          {
            keys: ['Alt', '←/→'],
            description: 'Move shot to previous/next lane',
          },
          {
            keys: ['Cmd/Ctrl', 'Z'],
            description: 'Undo last move',
          },
        ],
      };
    }

    // Add more page-specific shortcuts here as needed
    // Example:
    // if (pathname.includes('/shots')) {
    //   return {
    //     title: 'Shots Shortcuts',
    //     shortcuts: [...]
    //   };
    // }

    // No page-specific shortcuts for this page
    return null;
  }, [location.pathname]);

  return pageShortcuts;
}
