/**
 * Unit-test entry for esbuild bundling (runs outside VS Code Extension Host).
 * Import all unit suites so mocha registers them when this file is loaded.
 */
import './suite/unit/table-convert.test';
import './suite/unit/markdown-serializer.test';
import './suite/unit/gfm-format-toolbar.test';
import './suite/unit/image-numbering.test';
import './suite/unit/markdown-document.test';
import './suite/unit/editor-modes.test';
import './suite/unit/editor-mode-sync.test';
import './suite/unit/editor-switch-guard.test';
import './suite/unit/contribution-id-rename.test';
import './suite/unit/reload-extension.test';
import './suite/unit/webview-update-epoch.test';
import './suite/unit/preview-rich-embed.test';
import './suite/unit/preview-mode-quality.test';
import './suite/unit/fix-mermaid-dark-visibility.test';
import './suite/unit/mermaid-contrast-readable.test';
import './suite/unit/mermaid-snap-style-with-source.test';
import './suite/unit/fix-mermaid-edge-styles.test';
import './suite/unit/mermaid-redux-elk-fidelity.test';
import './suite/unit/mermaid-readable-viewport.test';
import './suite/unit/native-preview-side-and-default-raw.test';
import './suite/unit/table-context-menu.test';
import './suite/unit/find-replace-widget.test';
import './suite/unit/list-indent-and-paste.test';
import './suite/unit/plantuml-support.test';
import './suite/unit/document-export.test';
import './suite/unit/katex-math.test';
import './suite/unit/table-formatter.test';
import './suite/unit/editor-assist.test';

