/**
 * Unit-test entry for esbuild bundling (runs outside VS Code Extension Host).
 * Import all unit suites so mocha registers them when this file is loaded.
 */
import './suite/unit/table-convert.test';
import './suite/unit/markdown-serializer.test';
import './suite/unit/image-numbering.test';
import './suite/unit/markdown-document.test';
import './suite/unit/editor-modes.test';
import './suite/unit/editor-mode-sync.test';
import './suite/unit/editor-switch-guard.test';
import './suite/unit/reload-extension.test';
import './suite/unit/webview-update-epoch.test';
