/**
 * TC-IRE-001–024: Image Rich Editing unit tests (image-rich-editing).
 * Spec: doc/test/testspec-image-rich-editing.md / systemspec §7, §9.
 *
 * New pure helpers are resolved by name from existing modules
 * (markdown-serializer, image-numbering, sanitize) so this suite compiles
 * before implementation (Red). build-agent must export them from one of these modules.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as serializer from '../../../serializers/markdown-serializer';
import type { TipTapDoc, TipTapNode } from '../../../serializers/markdown-serializer';
import * as imageNumbering from '../../../utils/image-numbering';
import * as sanitize from '../../../utils/sanitize';

const { parseMarkdown, serializeMarkdown } = serializer;

type Align = 'left' | 'center' | 'right' | null;
type Mode = 'visual' | 'source' | 'preview';

function readRepoFile(...parts: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), ...parts), 'utf8');
}

function resolveHelper<T>(name: string): T {
  const sources: Record<string, unknown>[] = [
    serializer as unknown as Record<string, unknown>,
    imageNumbering as unknown as Record<string, unknown>,
    sanitize as unknown as Record<string, unknown>,
  ];
  for (const src of sources) {
    if (typeof src[name] === 'function') {
      return src[name] as T;
    }
  }
  assert.fail(`Helper "${name}" must be exported from markdown-serializer, image-numbering, or sanitize`);
}

function imageDoc(attrs: Record<string, unknown>): TipTapDoc {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'image', attrs }] }],
  } as TipTapDoc;
}

function findImage(nodes: TipTapNode[] | undefined): TipTapNode | undefined {
  for (const n of nodes ?? []) {
    if (n.type === 'image') {
      return n;
    }
    const inner = findImage(n.content);
    if (inner) {
      return inner;
    }
  }
  return undefined;
}

function ser(attrs: Record<string, unknown>): string {
  return serializeMarkdown(imageDoc(attrs)).trim();
}

const WEBVIEW_SRC = 'https://file+.vscode-resource.vscode-cdn.net/ws/doc/img/image-0002.png';

suite('image-rich-editing (TC-IRE-001–024)', () => {
  test('TC-IRE-001: width/align null serializes as standard Markdown image', () => {
    const out = ser({ src: WEBVIEW_SRC, originalSrc: 'img/image-0001.png', alt: 'diagram', title: null, width: null, align: null });
    assert.strictEqual(out, '![diagram](img/image-0001.png)');
  });

  test('TC-IRE-002: HTML <img /> fixed attribute order src→alt→title→width→align', () => {
    assert.strictEqual(
      ser({ src: 'img/image-0001.png', originalSrc: 'img/image-0001.png', alt: 'diagram', title: 't', width: '50%', align: 'center' }),
      '<img src="img/image-0001.png" alt="diagram" title="t" width="50%" align="center" />',
    );
    assert.strictEqual(
      ser({ src: 'img/image-0001.png', alt: 'diagram', title: null, width: '320', align: null }),
      '<img src="img/image-0001.png" alt="diagram" width="320" />',
    );
    assert.strictEqual(
      ser({ src: 'img/image-0001.png', alt: 'diagram', title: null, width: null, align: 'right' }),
      '<img src="img/image-0001.png" alt="diagram" align="right" />',
    );
  });

  test('TC-IRE-003: parse→serialize round-trip is idempotent for Markdown and HTML images', () => {
    for (const md of ['![a](img/x.png)\n', '<img src="img/x.png" alt="a" width="320" align="right" />\n']) {
      const once = serializeMarkdown(parseMarkdown(md));
      const twice = serializeMarkdown(parseMarkdown(once));
      assert.strictEqual(once.trim(), md.trim());
      assert.strictEqual(twice, once);
      if (md.startsWith('<img')) {
        const img = findImage(parseMarkdown(md).content);
        assert.ok(img, 'HTML <img> must parse into image node');
        assert.strictEqual(img.attrs?.width, '320');
        assert.strictEqual(img.attrs?.align, 'right');
      }
    }
  });

  test('TC-IRE-004: HTML attribute escaping and restoration', () => {
    const out = ser({ src: 'img/a.png', alt: 'a"b<c>&d', title: '"x"', width: '50%', align: null });
    assert.ok(out.includes('alt="a&quot;b&lt;c&gt;&amp;d"'), out);
    assert.ok(out.includes('title="&quot;x&quot;"'), out);
    const img = findImage(parseMarkdown(out + '\n').content);
    assert.strictEqual(img?.attrs?.alt, 'a"b<c>&d');
    assert.strictEqual(img?.attrs?.title, '"x"');
  });

  test('TC-IRE-005: empty alt is kept as alt="" in HTML form', () => {
    assert.strictEqual(
      ser({ src: 'img/a.png', alt: '', title: null, width: '25%', align: null }),
      '<img src="img/a.png" alt="" width="25%" />',
    );
  });

  test('TC-IRE-006: webview URI never leaks into serialized output', () => {
    const md = ser({ src: WEBVIEW_SRC, originalSrc: 'img/image-0002.png', alt: 'x', title: null, width: null, align: null });
    const html = ser({ src: WEBVIEW_SRC, originalSrc: 'img/image-0002.png', alt: 'x', title: null, width: '50%', align: null });
    for (const out of [md, html]) {
      assert.ok(!/vscode-resource|vscode-cdn|vscode-webview/.test(out), out);
      assert.ok(out.includes('img/image-0002.png'), out);
    }
    const noOriginal = ser({ src: 'vscode-webview://abc/img/image-0003.png', alt: 'x', title: null, width: '50%', align: null });
    assert.ok(!noOriginal.includes('vscode-webview'), noOriginal);
  });

  test('TC-IRE-007: relative and external src preserved; unsafe paths not resolved', () => {
    assert.strictEqual(ser({ src: 'img/sub/a.png', alt: '', title: null, width: '50%', align: null }), '<img src="img/sub/a.png" alt="" width="50%" />');
    assert.strictEqual(ser({ src: 'https://example.com/a.png', alt: 'e', title: null, width: null, align: null }), '![e](https://example.com/a.png)');
    assert.strictEqual(imageNumbering.isSafeImagePath('/ws/doc.md', 'img/sub/a.png'), true);
    assert.strictEqual(imageNumbering.isSafeImagePath('/ws/doc.md', '../a.png'), false);
    assert.strictEqual(imageNumbering.isSafeImagePath('/ws/doc.md', '/etc/a.png'), false);
  });

  test('TC-IRE-008: sanitizer keeps image allowlist and strips XSS', () => {
    const out = sanitize.sanitizeHtml(
      '<img src="img/a.png" alt="x" width="50%" height="10" align="left" data-align="left" onerror="alert(1)" onload="x" style="width:9px" class="c">',
    );
    for (const keep of ['src="img/a.png"', 'alt="x"', 'width="50%"', 'height="10"', 'align="left"', 'data-align="left"']) {
      assert.ok(out.includes(keep), `must keep ${keep}: ${out}`);
    }
    for (const drop of ['onerror', 'onload', 'style=', 'class=']) {
      assert.ok(!out.includes(drop), `must strip ${drop}: ${out}`);
    }
    assert.ok(!/javascript:/i.test(sanitize.sanitizeHtml('<img src="javascript:alert(1)" alt="x">')));
  });

  test('TC-IRE-009: invalid align/width values parse to null', () => {
    const img = findImage(parseMarkdown('<img src="img/a.png" alt="a" width="abc" align="middle" />\n').content);
    assert.ok(img, 'image node expected');
    assert.strictEqual(img.attrs?.align ?? null, null);
    assert.strictEqual(img.attrs?.width ?? null, null);
    const neg = findImage(parseMarkdown('<img src="img/a.png" alt="a" width="-5" />\n').content);
    assert.strictEqual(neg?.attrs?.width ?? null, null);
  });

  test('TC-IRE-010: CSP-safe rendering (attributes + external CSS, no inline style)', () => {
    const editorTs = readRepoFile('media', 'editor.ts');
    const css = readRepoFile('media', 'editor.css');
    const provider = readRepoFile('src', 'providers', 'markdown-editor-provider.ts');
    for (const a of ['left', 'center', 'right']) {
      assert.ok(new RegExp(`img\\[data-align=["']${a}["']\\]`).test(css), `css selector for ${a}`);
    }
    assert.ok(/data-align/.test(editorTs) && /data-width/.test(editorTs), 'editor must render data-align/data-width');
    assert.ok(!/\.style\.width\s*=/.test(editorTs), 'no element.style.width writes');
    assert.ok(!/'unsafe-inline'/.test(provider), "CSP must not include 'unsafe-inline'");
  });

  test('TC-IRE-011: size preset helper', () => {
    const f = resolveHelper<(p: string) => string | null>('applyImageSizePreset');
    assert.strictEqual(f('25%'), '25%');
    assert.strictEqual(f('50%'), '50%');
    assert.strictEqual(f('75%'), '75%');
    assert.strictEqual(f('100%'), null);
  });

  test('TC-IRE-012: drag width normalization clamps to [32, parentWidth] integer px', () => {
    const f = resolveHelper<(px: number, parent: number) => string>('normalizeImageDragWidth');
    assert.strictEqual(f(31, 800), '32');
    assert.strictEqual(f(32, 800), '32');
    assert.strictEqual(f(320.6, 800), '321');
    assert.strictEqual(f(810, 800), '800');
  });

  test('TC-IRE-013: align toggle helper', () => {
    const f = resolveHelper<(cur: Align, clicked: Exclude<Align, null>) => Align>('toggleImageAlign');
    assert.strictEqual(f(null, 'center'), 'center');
    assert.strictEqual(f('center', 'center'), null);
    assert.strictEqual(f('left', 'right'), 'right');
  });

  test('TC-IRE-014: alt update helper replaces alt only', () => {
    const f = resolveHelper<(attrs: Record<string, unknown>, alt: string) => Record<string, unknown>>('updateImageAlt');
    const base = { src: 'img/a.png', alt: 'old', width: '50%', align: 'left' };
    assert.deepStrictEqual(f(base, '  new alt '), { ...base, alt: '  new alt ' });
    assert.deepStrictEqual(f(base, ''), { ...base, alt: '' });
    assert.strictEqual(base.alt, 'old', 'input must not be mutated');
  });

  test('TC-IRE-015: webp drop saved as img/image-NNNN.webp without overwrite', () => {
    assert.strictEqual(imageNumbering.mimeToExtension('image/webp'), 'webp');
    const plan = resolveHelper<(files: { name: string; type: string }[], existing: string[]) => { filename: string }[]>('planDroppedImageFiles');
    const r = plan([{ name: 'a.webp', type: 'image/webp' }], ['image-0001.png']);
    assert.deepStrictEqual(r.map((x) => x.filename), ['image-0002.webp']);
  });

  test('TC-IRE-016: multiple dropped files numbered in list order', () => {
    const plan = resolveHelper<(files: { name: string; type: string }[], existing: string[]) => { filename: string }[]>('planDroppedImageFiles');
    const r = plan(
      [{ name: 'a.png', type: 'image/png' }, { name: 'b.jpg', type: 'image/jpeg' }, { name: 'c.gif', type: 'image/gif' }],
      ['image-0003.png'],
    );
    assert.deepStrictEqual(r.map((x) => x.filename), ['image-0004.png', 'image-0005.jpg', 'image-0006.gif']);
  });

  test('TC-IRE-017: untitled / non-image drops rejected; mixed keeps images only', () => {
    const canDrop = resolveHelper<(ctx: { mode: Mode; readonly: boolean; untitled: boolean }) => { ok: boolean; reason?: string }>('canInsertDroppedImage');
    const r = canDrop({ mode: 'visual', readonly: false, untitled: true });
    assert.strictEqual(r.ok, false);
    assert.ok(r.reason, 'untitled rejection must carry a reason for notification');
    const plan = resolveHelper<(files: { name: string; type: string }[], existing: string[]) => { filename: string }[]>('planDroppedImageFiles');
    assert.deepStrictEqual(plan([{ name: 'a.txt', type: 'text/plain' }, { name: 'b.pdf', type: 'application/pdf' }], []), []);
    assert.deepStrictEqual(
      plan([{ name: 'a.png', type: 'image/png' }, { name: 'b.pdf', type: 'application/pdf' }], []).map((x) => x.filename),
      ['image-0001.png'],
    );
  });

  test('TC-IRE-018: drop suppressed in Readonly and Preview', () => {
    const canDrop = resolveHelper<(ctx: { mode: Mode; readonly: boolean; untitled: boolean }) => { ok: boolean }>('canInsertDroppedImage');
    assert.strictEqual(canDrop({ mode: 'visual', readonly: true, untitled: false }).ok, false);
    assert.strictEqual(canDrop({ mode: 'preview', readonly: false, untitled: false }).ok, false);
    assert.strictEqual(canDrop({ mode: 'visual', readonly: false, untitled: false }).ok, true);
  });

  test('TC-IRE-019: non-file drags are not handled as image drops', () => {
    const isFileDrag = resolveHelper<(types: string[]) => boolean>('isImageFileDrag');
    assert.strictEqual(isFileDrag(['text/plain']), false);
    assert.strictEqual(isFileDrag(['text/html', 'text/plain']), false);
    assert.strictEqual(isFileDrag(['Files']), true);
  });

  test('TC-IRE-020: editor root guards dragover/drop default navigation', () => {
    const editorTs = readRepoFile('media', 'editor.ts');
    assert.ok(/addEventListener\(\s*['"]dragover['"]/.test(editorTs), 'dragover listener required');
    assert.ok(/addEventListener\(\s*['"]drop['"]/.test(editorTs), 'drop listener required');
    assert.ok(/preventDefault\(\)/.test(editorTs));
  });

  test('TC-IRE-021: Lightbox open conditions by mode and trigger', () => {
    const f = resolveHelper<(ctx: { mode: Mode; readonly: boolean; trigger: 'click' | 'dblclick' | 'zoom' }) => boolean>('shouldOpenLightbox');
    assert.strictEqual(f({ mode: 'preview', readonly: false, trigger: 'click' }), true);
    assert.strictEqual(f({ mode: 'visual', readonly: false, trigger: 'click' }), false);
    assert.strictEqual(f({ mode: 'visual', readonly: false, trigger: 'dblclick' }), true);
    assert.strictEqual(f({ mode: 'visual', readonly: false, trigger: 'zoom' }), true);
    assert.strictEqual(f({ mode: 'visual', readonly: true, trigger: 'click' }), true);
  });

  test('TC-IRE-022: Lightbox closes on Escape / backdrop', () => {
    const f = resolveHelper<(ev: { key?: string; target: 'backdrop' | 'image' | 'none' }) => boolean>('shouldCloseLightbox');
    assert.strictEqual(f({ key: 'Escape', target: 'none' }), true);
    assert.strictEqual(f({ target: 'backdrop' }), true);
    assert.strictEqual(f({ target: 'image' }), false);
    assert.strictEqual(f({ key: 'Enter', target: 'none' }), false);
  });

  test('TC-IRE-023: Lightbox open/close has no document side effects', () => {
    const editorTs = readRepoFile('media', 'editor.ts');
    const m = /lightbox[\s\S]{0,4000}/i.exec(editorTs);
    assert.ok(m, 'lightbox implementation must exist in media/editor.ts');
    const md = '<img src="img/a.png" alt="a" width="50%" />\n';
    const doc = parseMarkdown(md);
    const f = resolveHelper<(ctx: { mode: Mode; readonly: boolean; trigger: 'click' | 'dblclick' | 'zoom' }) => boolean>('shouldOpenLightbox');
    f({ mode: 'preview', readonly: false, trigger: 'click' });
    assert.strictEqual(serializeMarkdown(doc), serializeMarkdown(parseMarkdown(md)));
  });

  test('TC-IRE-024: image popover UI strings exist in English', () => {
    const editorTs = readRepoFile('media', 'editor.ts');
    for (const label of ['25%', '50%', '75%', '100%', 'Align left', 'Align center', 'Align right', 'Alt text', 'Zoom']) {
      assert.ok(editorTs.includes(label), `popover label missing: ${label}`);
    }
  });
});
