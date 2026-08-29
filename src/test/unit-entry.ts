/**
 * Unit-test entry for esbuild bundling (runs outside VS Code Extension Host).
 * Import all unit suites so mocha registers them when this file is loaded.
 */
import './suite/unit/markdown-serializer.test';
import './suite/unit/image-numbering.test';
import './suite/unit/markdown-document.test';
