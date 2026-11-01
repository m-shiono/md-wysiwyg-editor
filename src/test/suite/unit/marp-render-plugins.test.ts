import * as assert from 'assert';
import { renderMarpPreviewFragment } from '../../../utils/marp-render';

const FRONT = '---\nmarp: true\n---\n';

suite('marp-render plugins (marp-core v5 regression guard)', () => {
  test('renders inline and display math with KaTeX', () => {
    const html = renderMarpPreviewFragment(`${FRONT}# t\n\n$a^2+b^2$\n\n$$\\frac{1}{2}$$\n`);
    assert.ok(html, 'fragment expected');
    assert.ok(/class="katex"/.test(html!), 'KaTeX markup missing — math not rendered');
    assert.ok(/katex-display/.test(html!), 'display math missing');
  });

  test('uses the supplied local font path and never the CDN', () => {
    const html = renderMarpPreviewFragment(`${FRONT}$x$\n`, {
      katexFontPath: 'vscode-webview://ext/media/fonts',
    })!;
    assert.ok(html.includes('vscode-webview://ext/media/fonts'));
    assert.ok(!html.includes('cdn.jsdelivr.net'));
  });

  test('emits no external font URL when no font path is given', () => {
    const html = renderMarpPreviewFragment(`${FRONT}$x$\n`)!;
    assert.ok(!html.includes('cdn.jsdelivr.net'));
  });

  test('highlights fenced code with class-based tokens and ships their CSS', () => {
    const html = renderMarpPreviewFragment(`${FRONT}\`\`\`js\nconst a = 1; // c\n\`\`\`\n`)!;
    assert.ok(/class="hljs-keyword"/.test(html), 'token spans must survive sanitizeHtml');
    assert.ok(/\.hljs-keyword/.test(html), 'token CSS missing');
  });

  test('escapes code in unknown languages instead of injecting it', () => {
    const html = renderMarpPreviewFragment(`${FRONT}\`\`\`nosuchlang\n<img src=x onerror=alert(1)>\n\`\`\`\n`)!;
    assert.ok(html.includes('&lt;img'));
    assert.ok(!/<img[^>]*onerror/i.test(html));
  });

  test('returns undefined for non-Marp documents', () => {
    assert.strictEqual(renderMarpPreviewFragment('# plain'), undefined);
  });
});
