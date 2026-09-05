/**
 * TC-152: regression — Mermaid NodeView DOMPurify must keep flowchart foreignObject labels.
 * Pre-fix: media/editor.ts uses bare DOMPurify.sanitize(svg) → labels stripped (Red).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function readRepoFile(...parts: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), ...parts), 'utf8');
}

/** Minimal Mermaid-like SVG: HTML label lives inside foreignObject (flowchart NodeView). */
const MERMAID_FLOWCHART_SVG_FIXTURE = [
  '<svg xmlns="http://www.w3.org/2000/svg">',
  '<g class="node">',
  '<foreignObject width="80" height="40">',
  '<div xmlns="http://www.w3.org/1999/xhtml">Cause A</div>',
  '</foreignObject>',
  '</g>',
  '<text>Simple Approach</text>',
  '</svg>',
].join('');

suite('fix-mermaid-dark-visibility (TC-152)', () => {
  test('TC-152: regression — Mermaid SVG sanitize keeps foreignObject node labels', () => {
    const editorSrc = readRepoFile('media/editor.ts');

    // 根本原因: 既定 sanitize は flowchart の foreignObject（HTML labels）を除去する
    const usesBareMermaidSanitize =
      /preview\.innerHTML\s*=\s*DOMPurify\.sanitize\(\s*svg\s*\)\s*;/.test(editorSrc);
    assert.ok(
      !usesBareMermaidSanitize,
      'Mermaid preview must not use default DOMPurify.sanitize(svg); it strips foreignObject labels',
    );

    // 期待: options で foreignObject を許可するか、専用 helper 経由でラベルを残す
    const preservesViaSanitizeOptions =
      /preview\.innerHTML\s*=\s*DOMPurify\.sanitize\(\s*svg\s*,[\s\S]*?foreignObject[\s\S]*?\)\s*;/.test(
        editorSrc,
      );
    const preservesViaHelper =
      /preview\.innerHTML\s*=\s*sanitizeMermaidSvg\(\s*svg\s*\)\s*;/.test(editorSrc);

    assert.ok(
      preservesViaSanitizeOptions || preservesViaHelper,
      'Mermaid sanitize path must keep foreignObject (ADD_TAGS / options or sanitizeMermaidSvg)',
    );

    // Fixture documents the expected post-sanitize contract for build-agent
    assert.ok(
      MERMAID_FLOWCHART_SVG_FIXTURE.includes('foreignObject'),
      'fixture must include foreignObject HTML label',
    );
    assert.ok(
      MERMAID_FLOWCHART_SVG_FIXTURE.includes('Cause A'),
      'fixture must include node label text',
    );
  });
});
