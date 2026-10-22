/**
 * Markdown Editor Assist Utility
 * Provides list continuation, indentation, task list toggle, formatting toggles,
 * smart URL paste, and Table of Contents (TOC) generation.
 */

export interface KeyActionResult {
  updatedText: string;
  newSelectionStart: number;
  newSelectionEnd: number;
  handled: boolean;
}

/**
 * Handle Enter key in list items (continue list or terminate on empty item).
 */
export function handleListAutoContinue(
  text: string,
  cursorOffset: number
): KeyActionResult | null {
  const lineStart = text.lastIndexOf('\n', cursorOffset - 1) + 1;
  let lineEnd = text.indexOf('\n', cursorOffset);
  if (lineEnd === -1) {
    lineEnd = text.length;
  }

  const currentLine = text.slice(lineStart, lineEnd);
  const textBeforeCursorInLine = text.slice(lineStart, cursorOffset);

  // 1: indent, 2: bullet or number, 3: optional task checkbox, 4: content after marker
  const listMatch = currentLine.match(/^(\s*)([-*+]|\d+\.)(?:\s+(\[[ xX]\]))?(?:\s+(.*))?$/);
  if (!listMatch) {
    return null;
  }

  const indent = listMatch[1];
  const marker = listMatch[2];
  const hasCheckbox = Boolean(listMatch[3]);
  const content = listMatch[4] || '';

  // Case 1: Empty list item (user pressed Enter on empty bullet) -> terminate list
  if (content.trim().length === 0) {
    // Delete the bullet on the current line and leave an empty line
    const updatedText = text.slice(0, lineStart) + indent + text.slice(lineEnd);
    const newPos = lineStart + indent.length;
    return {
      updatedText,
      newSelectionStart: newPos,
      newSelectionEnd: newPos,
      handled: true,
    };
  }

  // Case 2: Only continue list if cursor is after marker
  const markerLength = indent.length + marker.length + (hasCheckbox ? 5 : 1);
  if (textBeforeCursorInLine.length < markerLength) {
    return null;
  }

  let nextMarker = marker;
  // If ordered list, increment number
  const numMatch = marker.match(/^(\d+)\.$/);
  if (numMatch) {
    const nextNum = parseInt(numMatch[1], 10) + 1;
    nextMarker = `${nextNum}.`;
  }

  // Reset task checkbox to unchecked [ ] for new item
  const nextCheckbox = hasCheckbox ? '[ ] ' : '';
  const continuation = `\n${indent}${nextMarker} ${nextCheckbox}`;

  const updatedText =
    text.slice(0, cursorOffset) + continuation + text.slice(cursorOffset);
  const newPos = cursorOffset + continuation.length;

  return {
    updatedText,
    newSelectionStart: newPos,
    newSelectionEnd: newPos,
    handled: true,
  };
}

/**
 * Handle Tab / Shift+Tab indentation for lists.
 */
export function handleListIndent(
  text: string,
  cursorOffset: number,
  direction: 'indent' | 'outdent'
): KeyActionResult | null {
  const lineStart = text.lastIndexOf('\n', cursorOffset - 1) + 1;
  let lineEnd = text.indexOf('\n', cursorOffset);
  if (lineEnd === -1) {
    lineEnd = text.length;
  }

  const currentLine = text.slice(lineStart, lineEnd);
  // Match list items
  const isList = /^\s*([-*+]|\d+\.)\s+/.test(currentLine);
  if (!isList) {
    return null;
  }

  if (direction === 'indent') {
    // Add 2 spaces at line start
    const updatedText = text.slice(0, lineStart) + '  ' + text.slice(lineStart);
    const newPos = cursorOffset + 2;
    return {
      updatedText,
      newSelectionStart: newPos,
      newSelectionEnd: newPos,
      handled: true,
    };
  } else {
    // Outdent: Remove up to 2 leading spaces if present
    const leadingSpaces = currentLine.match(/^ {1,2}/);
    if (!leadingSpaces) {
      return null;
    }
    const removedCount = leadingSpaces[0].length;
    const updatedText = text.slice(0, lineStart) + text.slice(lineStart + removedCount);
    const newPos = Math.max(lineStart, cursorOffset - removedCount);
    return {
      updatedText,
      newSelectionStart: newPos,
      newSelectionEnd: newPos,
      handled: true,
    };
  }
}

/**
 * Toggle task list item checkbox (- [ ] <-> - [x]).
 */
export function toggleTaskList(
  text: string,
  cursorOffset: number
): KeyActionResult | null {
  const lineStart = text.lastIndexOf('\n', cursorOffset - 1) + 1;
  let lineEnd = text.indexOf('\n', cursorOffset);
  if (lineEnd === -1) {
    lineEnd = text.length;
  }

  const currentLine = text.slice(lineStart, lineEnd);

  // Case 1: Unchecked to Checked
  if (/^(\s*[-*+]\s+)\[ \]/i.test(currentLine)) {
    const updatedLine = currentLine.replace(/^(\s*[-*+]\s+)\[ \]/i, '$1[x]');
    const updatedText = text.slice(0, lineStart) + updatedLine + text.slice(lineEnd);
    return {
      updatedText,
      newSelectionStart: cursorOffset,
      newSelectionEnd: cursorOffset,
      handled: true,
    };
  }

  // Case 2: Checked to Unchecked
  if (/^(\s*[-*+]\s+)\[[xX]\]/.test(currentLine)) {
    const updatedLine = currentLine.replace(/^(\s*[-*+]\s+)\[[xX]\]/, '$1[ ]');
    const updatedText = text.slice(0, lineStart) + updatedLine + text.slice(lineEnd);
    return {
      updatedText,
      newSelectionStart: cursorOffset,
      newSelectionEnd: cursorOffset,
      handled: true,
    };
  }

  // Case 3: Regular list item -> convert to task item
  if (/^(\s*[-*+]\s+)(?!\[[ xX]\])/.test(currentLine)) {
    const updatedLine = currentLine.replace(/^(\s*[-*+]\s+)/, '$1[ ] ');
    const updatedText = text.slice(0, lineStart) + updatedLine + text.slice(lineEnd);
    const newPos = cursorOffset + 4;
    return {
      updatedText,
      newSelectionStart: newPos,
      newSelectionEnd: newPos,
      handled: true,
    };
  }

  return null;
}

/**
 * Toggle inline formatting wrap around selection.
 */
export function toggleFormatting(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  wrapper: '**' | '*' | '~~' | '$' | '`'
): KeyActionResult {
  const wrapLen = wrapper.length;
  const isCollapsed = selectionStart === selectionEnd;

  if (isCollapsed) {
    // If collapsed, insert wrapper twice and put cursor between them
    const updatedText =
      text.slice(0, selectionStart) + wrapper + wrapper + text.slice(selectionEnd);
    const newPos = selectionStart + wrapLen;
    return {
      updatedText,
      newSelectionStart: newPos,
      newSelectionEnd: newPos,
      handled: true,
    };
  }

  const selectedText = text.slice(selectionStart, selectionEnd);

  // Check if selection itself is already wrapped
  if (
    selectedText.startsWith(wrapper) &&
    selectedText.endsWith(wrapper) &&
    selectedText.length >= wrapLen * 2
  ) {
    const unwrapped = selectedText.slice(wrapLen, -wrapLen);
    const updatedText = text.slice(0, selectionStart) + unwrapped + text.slice(selectionEnd);
    return {
      updatedText,
      newSelectionStart: selectionStart,
      newSelectionEnd: selectionStart + unwrapped.length,
      handled: true,
    };
  }

  // Check if text immediately surrounding selection is wrapped
  const before = text.slice(Math.max(0, selectionStart - wrapLen), selectionStart);
  const after = text.slice(selectionEnd, selectionEnd + wrapLen);
  if (before === wrapper && after === wrapper) {
    const updatedText =
      text.slice(0, selectionStart - wrapLen) + selectedText + text.slice(selectionEnd + wrapLen);
    return {
      updatedText,
      newSelectionStart: selectionStart - wrapLen,
      newSelectionEnd: selectionEnd - wrapLen,
      handled: true,
    };
  }

  // Otherwise, wrap selection
  const wrapped = wrapper + selectedText + wrapper;
  const updatedText = text.slice(0, selectionStart) + wrapped + text.slice(selectionEnd);
  return {
    updatedText,
    newSelectionStart: selectionStart,
    newSelectionEnd: selectionStart + wrapped.length,
    handled: true,
  };
}

/**
 * Smart URL Paste: If text is selected and clipboard contains a valid URL,
 * format as `[selectedText](url)`.
 */
export function handleSmartUrlPaste(
  selectedText: string,
  pastedText: string
): string | null {
  const trimmedUrl = pastedText.trim();
  const isUrl = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmedUrl);
  if (!isUrl || selectedText.trim().length === 0) {
    return null;
  }
  // Disallow multiline selection for link creation
  if (selectedText.includes('\n') || selectedText.includes('\r')) {
    return null;
  }
  // If already a markdown link [Title](url), replace url
  const existingLinkMatch = selectedText.match(/^\[(.*)\]\([^)]+\)$/);
  if (existingLinkMatch) {
    return `[${existingLinkMatch[1]}](${trimmedUrl})`;
  }
  return `[${selectedText}](${trimmedUrl})`;
}

/**
 * Clean markdown markup from heading text for safe display in TOC link labels.
 */
export function cleanHeadingForToc(heading: string): string {
  return heading
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url) -> link
    .replace(/[*_~`]/g, '') // remove *, _, ~, `
    .trim();
}

/**
 * Generate anchor slug for heading (GitHub Flavored Markdown compliant).
 */
export function slugifyHeading(heading: string): string {
  const cleaned = cleanHeadingForToc(heading);
  return cleaned
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // preserve letters, numbers, whitespace, hyphens across all languages
    .replace(/\s+/g, '-');
}

export interface HeadingItem {
  level: number;
  text: string;
  slug: string;
}

/**
 * Parse all headings (H1-H6) from markdown text.
 */
export function extractHeadings(markdown: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const lines = markdown.split('\n');
  let inCodeBlock = false;

  const slugCounts = new Map<string, number>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      continue;
    }

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const rawHeading = match[2].trim();
      const headingText = cleanHeadingForToc(rawHeading);
      let slug = slugifyHeading(rawHeading);

      // Handle duplicate slugs by appending -1, -2 etc.
      const count = slugCounts.get(slug) || 0;
      slugCounts.set(slug, count + 1);
      if (count > 0) {
        slug = `${slug}-${count}`;
      }

      headings.push({ level, text: headingText, slug });
    }
  }
  return headings;
}

/**
 * Generate Markdown Table of Contents block from headings.
 */
export function generateTableOfContents(markdown: string): string {
  const headings = extractHeadings(markdown);
  if (headings.length === 0) {
    return '<!-- TOC -->\n<!-- /TOC -->';
  }

  const minLevel = Math.min(...headings.map((h) => h.level));
  const listItems = headings.map((h) => {
    const indentLevel = Math.max(0, h.level - minLevel);
    const indent = '  '.repeat(indentLevel);
    return `${indent}- [${h.text}](#${h.slug})`;
  });

  return `<!-- TOC -->\n\n${listItems.join('\n')}\n\n<!-- /TOC -->`;
}

/**
 * Insert or update TOC in the markdown text.
 */
export function updateOrInsertTableOfContents(markdown: string): string {
  const tocBlock = generateTableOfContents(markdown);
  const tocRegex = /<!--\s*TOC\s*-->[\s\S]*?<!--\s*\/TOC\s*-->/i;

  if (tocRegex.test(markdown)) {
    return markdown.replace(tocRegex, tocBlock);
  }

  // If no TOC exists, insert at the beginning (or after frontmatter)
  if (markdown.startsWith('---')) {
    const secondFence = markdown.indexOf('\n---', 3);
    if (secondFence !== -1) {
      const insertPos = secondFence + 4; // after \n---
      return (
        markdown.slice(0, insertPos) + '\n\n' + tocBlock + '\n' + markdown.slice(insertPos)
      );
    }
  }

  return `${tocBlock}\n\n${markdown}`;
}
