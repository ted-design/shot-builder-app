/**
 * Mention utilities for user tagging in comments and notes
 *
 * Mention format: @[DisplayName](userId)
 * Example: @[Alex Rivera](abc123xyz)
 *
 * This format:
 * - Displays as "@DisplayName" to users
 * - Stores userId for notification triggers
 * - Survives HTML sanitization
 * - Is easy to parse with regex
 */

/**
 * Regular expression to match mention patterns
 * Format: @[DisplayName](userId)
 */
const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * HTML-escape a string to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';

  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Extract mentioned user IDs from HTML content
 * @param {string} html - HTML content with mentions
 * @returns {string[]} - Array of unique user IDs
 */
export function getMentionedUserIds(html) {
  if (!html || typeof html !== 'string') return [];

  const userIds = [];
  const matches = html.matchAll(MENTION_REGEX);

  for (const match of matches) {
    const userId = match[2];
    if (userId && !userIds.includes(userId)) {
      userIds.push(userId);
    }
  }

  return userIds;
}

/**
 * Parse mentions from HTML and return structured data
 * @param {string} html - HTML content with mentions
 * @returns {Array<{displayName: string, userId: string}>} - Array of mention objects
 */
export function parseMentions(html) {
  if (!html || typeof html !== 'string') return [];

  const mentions = [];
  const matches = html.matchAll(MENTION_REGEX);

  for (const match of matches) {
    const displayName = match[1];
    const userId = match[2];

    if (displayName && userId) {
      mentions.push({ displayName, userId });
    }
  }

  return mentions;
}

/**
 * Format a mention for insertion into contentEditable
 * @param {Object} user - User object
 * @param {string} user.id - User ID
 * @param {string} user.displayName - Display name
 * @param {string} [user.email] - Email (fallback if no displayName)
 * @returns {string} - Formatted mention string
 */
export function formatMention(user) {
  if (!user || !user.id) return '';

  const displayName = user.displayName || user.email || 'Unknown User';
  // Escape special characters that could break the mention format
  const sanitizedName = displayName.replace(/[\[\]()]/g, '');
  const sanitizedId = user.id.replace(/[\[\]()]/g, '');
  return `@[${sanitizedName}](${sanitizedId})`;
}

/**
 * Convert mention markup to styled HTML for display
 * Replaces @[Name](userId) with styled span elements
 * @param {string} html - HTML content with mentions
 * @returns {string} - HTML with styled mentions
 */
export function renderMentions(html) {
  if (!html || typeof html !== 'string') return html;

  return html.replace(
    MENTION_REGEX,
    (match, displayName) => {
      const escapedName = escapeHtml(displayName);
      return `<span class="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">@${escapedName}</span>`;
    }
  );
}

/**
 * Strip mention markup and leave only display names
 * Useful for plain text output or search indexing
 * @param {string} html - HTML content with mentions
 * @returns {string} - Plain text with @mentions
 */
export function stripMentionMarkup(html) {
  if (!html || typeof html !== 'string') return html;

  return html.replace(
    MENTION_REGEX,
    (match, displayName) => `@${escapeHtml(displayName)}`
  );
}

/**
 * Check if text contains any mentions
 * @param {string} html - HTML content to check
 * @returns {boolean} - True if mentions are found
 */
export function hasMentions(html) {
  if (!html || typeof html !== 'string') return false;
  return MENTION_REGEX.test(html);
}

/**
 * Get cursor position in contentEditable element
 * Used for positioning mention autocomplete dropdown
 * @param {HTMLElement} element - ContentEditable element
 * @returns {{x: number, y: number, text: string} | null} - Cursor position and surrounding text
 */
export function getCursorPosition(element) {
  if (!element) return null;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Get text before cursor for mention detection
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  const text = preCaretRange.toString();

  return {
    x: rect.left,
    y: rect.top + rect.height,
    text: text,
  };
}

/**
 * Detect if cursor is in mention mode (just typed @)
 * @param {string} text - Text before cursor
 * @returns {{inMentionMode: boolean, query: string}} - Whether in mention mode and current query
 */
export function detectMentionMode(text) {
  if (!text || typeof text !== 'string') {
    return { inMentionMode: false, query: '' };
  }

  // Look for @ followed by word characters (mention query)
  // Stop at space, newline, or punctuation (except - and _)
  const mentionMatch = text.match(/@([\w-]*)$/);

  if (mentionMatch) {
    return {
      inMentionMode: true,
      query: mentionMatch[1], // Text after @
    };
  }

  return { inMentionMode: false, query: '' };
}

/**
 * Insert mention at cursor position in contentEditable
 * @param {HTMLElement} element - ContentEditable element
 * @param {string} mention - Formatted mention string (@[Name](userId))
 * @param {string} query - The query text to replace (text after @)
 */
export function insertMentionAtCursor(element, mention, query = '') {
  if (!element || !mention) return;

  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      console.warn('[mentions] No selection available for mention insertion');
      return;
    }

    const range = selection.getRangeAt(0);

    // Validate range properties
    if (!range.startContainer || typeof range.startOffset !== 'number') {
      console.warn('[mentions] Invalid range properties');
      return;
    }

    // Ensure we're working with a text node or element that can contain text
    const container = range.startContainer;
    if (container.nodeType !== Node.TEXT_NODE && container.nodeType !== Node.ELEMENT_NODE) {
      console.warn('[mentions] Selection is in unexpected node type:', container.nodeType);
      return;
    }

    // Delete the @ and query text
    const deleteLength = query.length + 1; // +1 for @
    for (let i = 0; i < deleteLength; i++) {
      const newOffset = Math.max(0, range.startOffset - 1);
      // Prevent going before the start of the container
      if (newOffset < 0 || range.startContainer.length !== undefined && newOffset > range.startContainer.length) {
        break;
      }
      range.setStart(range.startContainer, newOffset);
    }
    range.deleteContents();

    // Insert mention text + space
    const textNode = document.createTextNode(mention + ' ');
    range.insertNode(textNode);

    // Move cursor after the inserted text
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    // Trigger input event for React to detect change
    element.dispatchEvent(new Event('input', { bubbles: true }));
  } catch (error) {
    console.error('[mentions] Error inserting mention:', error);
    // Gracefully fail - don't crash the app
  }
}
