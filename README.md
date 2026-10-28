# MD WYSIWYG Editor

[日本語のドキュメント (Japanese)](https://github.com/m-shiono/md-wysiwyg-editor/blob/main/README.ja.md)

A WYSIWYG Markdown editor extension for Visual Studio Code.
It allows you to intuitively edit rich tables, diagrams, and images with an editing experience similar to Word or Excel, while keeping your documentation managed under Git version control.

Extension ID: `mshiono.vsc-md-editor`

## Key Features

### 1. Flexible Editing & Viewing Modes
You can easily switch between modes from the top toolbar at any time. The initial mode when opening a file can be customized via the `md-wysiwyg-editor.defaultMode` setting (default: Visual).

- Visual: A visual WYSIWYG editor where you can format headings (H1-H6), italics, strikethrough, bullet lists, task lists, blockquotes, links, code blocks, and horizontal rules in real time.
- Source: A plain-text editor to view and edit raw Markdown source code directly.
- Preview: A read-only preview that renders your Markdown, including real-time Mermaid diagrams and Marp slides.

### 2. Seamless Integration with VS Code Default Preview
Clicking the Default Preview button on the toolbar opens the built-in VS Code Markdown preview in the same tab group. If there are unsaved changes, it prompts you to save before displaying the preview.

### 3. Intuitive Table Editing
Supports flexible spreadsheet-like table operations, including line breaks within cells, bullet lists, and interactive checkboxes inside table cells.

### 4. Real-Time Mermaid Diagram Rendering
Instantly visualizes ` ```mermaid ` blocks into interactive diagrams. Supports zoom, pan, and scroll operations.

### 5. Marp Slide Preview
When Marp slide syntax is detected, presentation slides are automatically rendered in the preview.

### 6. Quick Clipboard Image Pasting
Paste images directly from your clipboard into the editor. Images are automatically saved to a local `img/` directory, and relative image links are inserted into your Markdown document.

### 7. Readonly Mode Protection
Lock editing on a per-file basis to prevent accidental edits while browsing documents.

## Getting Started

### Opening a Markdown File
Simply open any `.md` file, and the editor will launch automatically.

### Setting as Default Editor (Optional)
To always open Markdown files with this editor by default, add the following entry to your `settings.json`:

```json
{
  "workbench.editorAssociations": {
    "*.md": "md-wysiwyg-editor.wysiwyg"
  },
  "md-wysiwyg-editor.defaultMode": "visual" // "visual" | "source" | "preview"
}
```

