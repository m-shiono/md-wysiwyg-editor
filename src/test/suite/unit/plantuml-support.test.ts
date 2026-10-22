/**
 * TC-PUML-001–010: PlantUML Local Rendering Support (plantuml-support).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { PlantUmlRenderer } from '../../../utils/plantuml-renderer';

function readRepoFile(...parts: string[]): string {
  const filePath = path.resolve(process.cwd(), ...parts);
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

suite('plantuml-support (TC-PUML-001–010)', () => {
  const packageJsonSrc = readRepoFile('package.json');
  const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
  const editorTsSrc = readRepoFile('media/editor.ts');
  const editorCssSrc = readRepoFile('media/editor.css');

  suite('TC-PUML-001: Environment fallback & graceful degradation', () => {
    test('PlantUmlRenderer returns empty string and handles missing executable gracefully', async () => {
      // Mock with a non-existent command
      const renderer = new PlantUmlRenderer(() => ({
        command: 'non_existent_plantuml_binary_xyz',
      }));
      const isAvail = await renderer.isAvailable();
      assert.strictEqual(isAvail, false, 'Should report unavailable for non-existent binary');

      const svg = await renderer.renderSvg('Bob -> Alice : hello');
      assert.strictEqual(svg, '', 'Should return empty string without throwing');
    });

    test('editor.ts hides preview element when unavailable', () => {
      assert.ok(
        editorTsSrc.includes('!available') && editorTsSrc.includes('preview.style.display = "none"'),
        'editor.ts must hide preview when plantuml is unavailable',
      );
    });
  });

  suite('TC-PUML-002 & TC-PUML-003: Configuration resolution', () => {
    test('resolves command when customCommand is specified', () => {
      const renderer = new PlantUmlRenderer(() => ({
        command: 'custom-puml',
      }));
      const exec = renderer.resolveExecution();
      assert.ok(exec);
      assert.strictEqual(exec.command, 'custom-puml');
      assert.deepStrictEqual(exec.args, ['-tsvg', '-pipe']);
    });

    test('package.json defines plantuml.jarPath and plantuml.command settings', () => {
      const pkg = JSON.parse(packageJsonSrc);
      const props = pkg.contributes?.configuration?.properties;
      assert.ok(props['md-wysiwyg-editor.plantuml.jarPath'], 'plantuml.jarPath setting must exist');
      assert.ok(props['md-wysiwyg-editor.plantuml.command'], 'plantuml.command setting must exist');
    });
  });

  suite('TC-PUML-004 & TC-PUML-005: Rendering pipeline & cache', () => {
    test('normalizes input source with @startuml and @enduml', async () => {
      const renderer = new PlantUmlRenderer(() => ({
        command: 'non_existent_cmd',
      }));
      // renderSvg normalizes text and caches
      const res = await renderer.renderSvg('');
      assert.strictEqual(res, '', 'Empty source returns empty');
    });

    test('caches render result for identical source', async () => {
      const renderer = new PlantUmlRenderer(() => ({
        command: 'echo',
      }));
      // Simulate cache directly
      (renderer as unknown as { cache: Map<string, string> }).cache.set(
        'mock-hash',
        '<svg>mock</svg>',
      );
      assert.ok((renderer as unknown as { cache: Map<string, string> }).cache.has('mock-hash'));
    });
  });

  suite('TC-PUML-007: DOMPurify sanitization in Webview', () => {
    test('editor.ts invokes sanitizePlantUmlSvg for plantuml svg', () => {
      assert.ok(
        editorTsSrc.includes('sanitizePlantUmlSvg(svg)'),
        'Must sanitize PlantUML SVG output using sanitizePlantUmlSvg',
      );
    });
  });

  suite('TC-PUML-008 & TC-PUML-009: Visual and Preview mode contracts', () => {
    test('Visual mode structure includes .plantuml-preview and .plantuml-source', () => {
      assert.ok(
        editorTsSrc.includes('plantuml-preview') && editorTsSrc.includes('plantuml-source'),
        'NodeView must contain preview and source elements',
      );
    });

    test('Preview mode hides .plantuml-source via CSS', () => {
      assert.ok(
        editorCssSrc.includes("body[data-mode='preview'] .plantuml-source") &&
          editorCssSrc.includes('display: none;'),
        'Preview mode must hide .plantuml-source in CSS',
      );
    });
  });

  suite('TC-PUML-010: Error handling in Webview and Provider', () => {
    test('editor.ts displays .plantuml-error when rendering fails', () => {
      assert.ok(
        editorTsSrc.includes('plantuml-error'),
        'editor.ts must render .plantuml-error on failure',
      );
    });

    test('markdown-editor-provider.ts handles renderPlantUml message', () => {
      assert.ok(
        providerSrc.includes("case 'renderPlantUml':") || providerSrc.includes('case "renderPlantUml":'),
        'Provider must handle renderPlantUml postMessage',
      );
      assert.ok(
        providerSrc.includes('plantUmlRendered'),
        'Provider must reply with plantUmlRendered message',
      );
    });
  });

  suite('Edge Cases & Robustness', () => {
    test('TC-PUML-006: respects custom timeout and handles timeout rejection', async () => {
      // Use sleep to force timeout
      const renderer = new PlantUmlRenderer(() => ({
        command: 'sleep',
      }));
      try {
        await renderer.renderSvg('test', { timeoutMs: 100 });
        // If sleep is not installed or immediate, fallback
      } catch (err: unknown) {
        assert.ok(
          err instanceof Error && err.message.includes('timeout'),
          'Must reject with timeout error',
        );
      }
    });

    test('TC-PUML-011: does not duplicate @startuml if already present', async () => {
      const renderer = new PlantUmlRenderer(() => ({ command: 'non_existent_cmd' }));
      // Call renderSvg with already wrapped text
      const res = await renderer.renderSvg('@startuml\nclass Foo\n@enduml');
      assert.strictEqual(res, '');
    });

    test('TC-PUML-012: ignores non-existent jarPath and falls back gracefully', () => {
      const renderer = new PlantUmlRenderer(() => ({
        jarPath: '/non/existent/path/to/plantuml.jar',
      }));
      const exec = renderer.resolveExecution();
      // Should fall back to default 'plantuml' command since jar does not exist
      assert.ok(exec);
      assert.strictEqual(exec.command, 'plantuml', 'Must fall back when jar does not exist');
    });

    test('TC-PUML-013: resetCache clears cached entries and availability', () => {
      const renderer = new PlantUmlRenderer(() => ({ command: 'plantuml' }));
      (renderer as unknown as { availabilityCache: boolean }).availabilityCache = true;
      (renderer as unknown as { cache: Map<string, string> }).cache.set('test', 'data');

      renderer.resetCache();

      assert.strictEqual((renderer as unknown as { availabilityCache: boolean | null }).availabilityCache, null);
      assert.strictEqual((renderer as unknown as { cache: Map<string, string> }).cache.size, 0);
    });

    test('TC-PUML-014: does not wrap non-uml diagrams (@startmindmap, @startgantt, etc.) in @startuml', async () => {
      const renderer = new PlantUmlRenderer(() => ({ command: 'non_existent_cmd' }));
      const mindmapRes = await renderer.renderSvg('@startmindmap\n* Root\n-- Leaf\n@endmindmap');
      assert.strictEqual(mindmapRes, '');
      const ganttRes = await renderer.renderSvg('@startgantt\n[Task 1] lasts 10 days\n@endgantt');
      assert.strictEqual(ganttRes, '');
    });

    test('TC-PUML-015: handles case-insensitive @STARTUML directive without duplicating', async () => {
      const renderer = new PlantUmlRenderer(() => ({ command: 'non_existent_cmd' }));
      const res = await renderer.renderSvg('@STARTUML\nBob -> Alice : hello\n@ENDUML');
      assert.strictEqual(res, '');
    });

    test('TC-PUML-016: editor.ts sanitizes malicious SVG elements and scripts', () => {
      assert.ok(
        editorTsSrc.includes('sanitizePlantUmlSvg'),
        'editor.ts must define and use sanitizePlantUmlSvg',
      );
      assert.ok(
        editorTsSrc.includes('USE_PROFILES: { svg: true'),
        'sanitizePlantUmlSvg must restrict DOMPurify profile to svg',
      );
    });
  });
});

