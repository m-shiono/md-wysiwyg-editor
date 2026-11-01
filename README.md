# MD WYSIWYG Editor

[日本語のドキュメント (Japanese)](https://github.com/m-shiono/md-wysiwyg-editor/blob/main/README.ja.md)

A full-featured WYSIWYG Markdown editor extension for Visual Studio Code.  
It allows you to intuitively edit rich tables, images, diagrams, and math formulas with an editing experience similar to Word or Excel, while keeping your documentation managed under Git version control.

Extension ID: `mshiono.vsc-md-editor`

---

## Key Features

### 1. Flexible 3-Way Editing & Viewing Modes
You can easily switch between modes from the top toolbar at any time.  
The initial mode when opening a file can be customized via the `md-wysiwyg-editor.defaultMode` setting (default: `visual`).

- **Visual (Rich Editor)**: A visual WYSIWYG editor where you can format headings (H1–H6), bold, italics, strikethrough, bullet lists, task lists, blockquotes, inline code, code blocks, horizontal rules, tables, images, and math in real time.
- **Source (Source Editor)**: A plain-text editor to view and edit raw Markdown source code directly. Features smart editing assists such as Tab cell navigation/alignment and list auto-continuation.
- **Preview (Editor Preview)**: A read-only preview that renders your Markdown cleanly, including real-time Mermaid diagrams, PlantUML, KaTeX formulas, and Marp presentation slides.
- **Default Preview Integration**: Clicking the `Default Preview` button opens the built-in VS Code Markdown preview in the same tab group (prompts to save if there are unsaved changes).

---

### 2. Powerful Spreadsheet-like Table Editing
Edit Markdown tables just like in a spreadsheet. Supports both GFM pipe tables and HTML tables (with rich cell content).

- **Context Menu & Toolbar Integration**: Right-click any table cell to quickly insert/delete rows and columns, or delete the table.
- **Column Alignment**: Switch column alignment between Left (`:---`), Center (`:---:`), and Right (`---:`) with a single click. Changes render immediately in Visual / Preview modes and round-trip faithfully into Markdown delimiter rows.
- **Row & Column Reordering and Duplication**: Move rows up/down (`Alt+↑`/`Alt+↓`), move columns left/right (`Alt+←`/`Alt+→`), and duplicate rows (`Shift+Alt+↓`) directly via keyboard shortcuts or menus.
- **Pipe Alignment Styles**: Customize delimiter alignment via `md-wysiwyg-editor.table.pipeAlignment`: choose `aligned` (padded with spaces to keep column lines vertically aligned, supporting East Asian / CJK full-width characters) or `compact` (minimal padding). In Source mode, press `Tab` / `Shift+Tab` to navigate cells and auto-align the table block.
- **Smart Paste from Excel / Spreadsheets**: Directly paste TSV or HTML `<table>` data copied from Excel, Google Sheets, or web pages into the editor to automatically expand into a Markdown table.
- **CSV/TSV Conversion & Backlog Support**: Convert selected text between CSV/TSV and Markdown tables, or copy/paste with Backlog Wiki/Issue markup (`|h`, `LEFT:`, `CENTER:`, `RIGHT:`, etc.).

---

### 3. Rich Image Editing & Drag-and-Drop
- **Clipboard Image Pasting**: Paste images directly from your clipboard. Images are automatically saved to a local `img/` directory (`image-NNNN.ext`) and referenced via relative Markdown links.
- **File Drag-and-Drop Insertion**: Drag image files (PNG, JPEG, GIF, SVG, WebP) directly from your OS (Finder / File Explorer) or VS Code explorer into the editor to automatically save and insert them.
- **Resize Handles & Size Presets**: Select an image in Visual mode to reveal drag-resize handles and size preset buttons (`25%`, `50%`, `75%`, `100% Reset`). Resized images round-trip deterministically as `<img width="..." />`.
- **Alignment & Alt Text Mini Popover**: Easily switch image alignment (Left, Center, Right) or edit Alt text via a lightweight floating popover.
- **Click to Expand (Lightbox Modal)**: Click images in Preview mode (or double-click / click Zoom button in Visual mode) to view them in a full-screen modal overlay. Close effortlessly with `Escape` or by clicking the backdrop.

---

### 4. Diagrams, Presentations & Math Rendering
- **Real-Time Mermaid Diagrams**: Instantly renders ` ```mermaid ` blocks into interactive diagrams with zoom, pan, Fit-to-screen, ELK layout integration (`@mermaid-js/layout-elk`), and automatic VS Code color theme adaptation.
- **PlantUML Rendering**: Renders ` ```plantuml ` blocks using a local Java / `plantuml.jar` / CLI environment. Your diagram source is kept private and never sent to external servers. Safely falls back to a code block if PlantUML is not installed locally.
- **KaTeX Math Formulas**: Renders LaTeX math blocks (` ```math ` / ` ```latex `) and inline formulas (`$E=mc^2$`) in real time.
- **Marp Presentation Slides**: When Marp slide frontmatter is detected, presentation slides are automatically rendered in Preview mode or in a dedicated side panel.

---

### 5. Find & Replace Widget
- Press `Cmd+F` / `Ctrl+F` to search, or `Cmd+H` / `Ctrl+H` to replace.
- Supported across all modes (Visual, Source, Preview) with Case Sensitivity (`[Aa]`), Whole Word (`[\b]`), Regular Expressions (`[.*]`), and single/batch replace with full Undo integration.

---

### 6. Document Exporting
Export your documents via the `Export Document...` command from the Command Palette or editor title bar:
- **HTML**: Self-contained standalone HTML including styles, embedded local images (Base64), and Mermaid/PlantUML SVGs.
- **PDF**: Print-ready PDF or high-fidelity Marp slide PDF.
- **DOCX (Word)**: Word document output via Pandoc or built-in conversion.
- **PPTX (PowerPoint)**: Marp slide deck output to PowerPoint presentation format.

---

### 7. Smart Editor Assistance
- **List Auto-Continuation**: Pressing `Enter` on a bullet (`-`, `*`, `+`) or numbered list (`1.`) automatically inserts the next list marker with automatic number incrementing. Press `Enter` on an empty item to terminate the list.
- **Task List Toggle**: Press `Alt+C` to toggle task list checkboxes (`- [ ]` / `- [x]`) on the current or selected lines.
- **Formatting Shortcuts**: Bold (`Cmd+B` / `Ctrl+B`), Italic (`Cmd+I` / `Ctrl+I`), Strikethrough (`Alt+S`), Inline Math (`Cmd+M` / `Ctrl+M`), and Link (`Cmd+K` / `Ctrl+K`).
- **Smart URL Paste**: Pasting a URL while text is selected automatically creates a markdown link `[selected text](URL)`.
- **Table of Contents (TOC) Generation**: Generates a hierarchical Markdown TOC from headings (H1–H6) that automatically syncs on save.

---

### 8. Readonly Protection
Lock editing on a per-file basis using `Toggle Readonly Mode` to prevent accidental edits while reading or reviewing documents.

---

## Getting Started

### Opening a Markdown File
Simply open any `.md` file, and the editor will launch automatically.

### Setting as Default Editor (Recommended)
To always open Markdown files with this editor by default, add the following to your VS Code `settings.json`:

```json
{
  "workbench.editorAssociations": {
    "*.md": "md-wysiwyg-editor.wysiwyg"
  },
  "md-wysiwyg-editor.defaultMode": "visual" // "visual" | "source" | "preview"
}
```

### Configuration Options
| Setting Key | Type | Default | Description |
|---|---|---|---|
| `md-wysiwyg-editor.defaultMode` | string | `"visual"` | Default editor mode when opening a file (`visual`, `source`, or `preview`). |
| `md-wysiwyg-editor.table.pipeAlignment` | string | `"aligned"` | Pipe table alignment style: `aligned` (padded to align column lines) or `compact` (minimal spaces). |
| `md-wysiwyg-editor.plantuml.jarPath` | string | `""` | Path to local `plantuml.jar` (if empty, searches environment variables or PATH). |
| `md-wysiwyg-editor.plantuml.command` | string | `""` | Custom command to run PlantUML (e.g. `'plantuml'` or `'java'`). |

---

## Keyboard Shortcuts

| Shortcut (Mac / Win) | Description |
|---|---|
| `Cmd+F` / `Ctrl+F` | Open Find Widget |
| `Cmd+H` / `Ctrl+H` | Open Replace Widget |
| `Alt+↑` / `Alt+↓` | (In table) Move row up / down |
| `Alt+←` / `Alt+→` | (In table) Move column left / right |
| `Shift+Alt+↓` | (In table) Duplicate current row |
| `Tab` / `Shift+Tab` | (In table) Move to next/previous cell & auto-align (adds row at last cell) |
| `Alt+C` | Toggle task list checkbox |
| `Cmd+B` / `Ctrl+B` | Toggle bold |
| `Cmd+I` / `Ctrl+I` | Toggle italic |
| `Alt+S` | Toggle strikethrough |
| `Cmd+M` / `Ctrl+M` | Toggle inline math |
| `Cmd+K` / `Ctrl+K` | Insert link syntax |
| `Escape` | Close Find & Replace widget or Lightbox image preview |
