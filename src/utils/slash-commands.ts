export type SlashCommandId =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'table'
  | 'codeBlock'
  | 'mermaid'
  | 'plantuml'
  | 'math'
  | 'blockquote'
  | 'horizontalRule'
  | 'toc';

export interface SlashCommandItem {
  id: SlashCommandId;
  label: string;
  description: string;
  keywords: string[];
}

export const SLASH_COMMANDS: readonly SlashCommandItem[] = [
  { id: 'h1', label: 'Heading 1', description: 'Large section heading', keywords: ['h1', 'heading', 'title'] },
  { id: 'h2', label: 'Heading 2', description: 'Medium section heading', keywords: ['h2', 'heading', 'subtitle'] },
  { id: 'h3', label: 'Heading 3', description: 'Small section heading', keywords: ['h3', 'heading'] },
  { id: 'bulletList', label: 'Bullet List', description: 'Unordered bulleted list', keywords: ['ul', 'bullet', 'list'] },
  { id: 'orderedList', label: 'Ordered List', description: 'Numbered list', keywords: ['ol', 'ordered', 'number', 'list'] },
  { id: 'taskList', label: 'Task List', description: 'Checklist with checkboxes', keywords: ['todo', 'task', 'checkbox', 'list'] },
  { id: 'table', label: 'Table', description: 'Insert 3x3 Markdown table', keywords: ['table', 'grid'] },
  { id: 'codeBlock', label: 'Code Block', description: 'Fenced code block', keywords: ['code', 'pre', 'fence'] },
  { id: 'mermaid', label: 'Mermaid Diagram', description: 'Flowchart, sequence, or ER diagram', keywords: ['mermaid', 'diagram', 'chart', 'flow'] },
  { id: 'plantuml', label: 'PlantUML Diagram', description: 'Local PlantUML diagram block', keywords: ['plantuml', 'puml', 'uml', 'diagram'] },
  { id: 'math', label: 'Math Block', description: 'LaTeX formula rendered with KaTeX', keywords: ['math', 'katex', 'latex', 'formula'] },
  { id: 'blockquote', label: 'Blockquote', description: 'Quoted text block', keywords: ['quote', 'blockquote'] },
  { id: 'horizontalRule', label: 'Horizontal Rule', description: 'Divider line (---)', keywords: ['hr', 'divider', 'line', 'rule'] },
  { id: 'toc', label: 'Table of Contents', description: 'Auto-generated heading index', keywords: ['toc', 'contents', 'index'] },
];

export interface SlashTriggerMatch {
  query: string;
  matchLength: number;
}

const SLASH_TRIGGER_RE = /(?:^|\s)(\/([a-zA-Z0-9_-]*))$/;

/**
 * Detect a `/query` slash command trigger immediately before the cursor.
 */
export function detectSlashTrigger(textBeforeCursor: string): SlashTriggerMatch | null {
  const match = textBeforeCursor.match(SLASH_TRIGGER_RE);
  if (!match) {
    return null;
  }
  return {
    query: match[2],
    matchLength: match[1].length,
  };
}

/**
 * Filter slash commands by matching query against id, label, description, or keywords.
 */
export function filterSlashCommands(query: string): SlashCommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...SLASH_COMMANDS];
  }
  return SLASH_COMMANDS.filter(
    (item) =>
      item.id.toLowerCase().includes(q) ||
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.keywords.some((kw) => kw.toLowerCase().includes(q)),
  );
}
