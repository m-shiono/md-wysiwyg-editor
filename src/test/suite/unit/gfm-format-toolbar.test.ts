/**
 * TC-107–123: GFM format toolbar contracts (gfm-format-toolbar).
 * Strict TDD Red — production serializer / toolbar / sanitize may fail until build-agent.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as serializer from '../../../serializers/markdown-serializer';
import type { TipTapDoc, TipTapNode } from '../../../serializers/markdown-serializer';
import { sanitizeHtml } from '../../../utils/sanitize';
import {
  acceptsWebviewContentUpdate,
  canEditContent,
  isVisualSurfaceReadOnly,
} from '../../../utils/editor-mode';

const { parseMarkdown, serializeMarkdown, roundTrip } = serializer;

function normalizeMd(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function collectTextNodes(node: TipTapNode, out: TipTapNode[] = []): TipTapNode[] {
  if (node.type === 'text') {
    out.push(node);
  }
  for (const child of node.content ?? []) {
    collectTextNodes(child, out);
  }
  return out;
}

function hasMark(node: TipTapNode, markType: string): boolean {
  return (node.marks ?? []).some((m) => m.type === markType);
}

function docHasMark(doc: TipTapDoc, markType: string): boolean {
  return doc.content.some((block) =>
    collectTextNodes(block).some((t) => hasMark(t, markType)),
  );
}

function findNode(doc: TipTapDoc, type: string): TipTapNode | undefined {
  const walk = (node: TipTapNode): TipTapNode | undefined => {
    if (node.type === type) {
      return node;
    }
    for (const child of node.content ?? []) {
      const found = walk(child);
      if (found) {
        return found;
      }
    }
    return undefined;
  };
  for (const block of doc.content) {
    const found = walk(block);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function readRepoFile(...parts: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), ...parts), 'utf8');
}

function formatToolbarHtmlFromProvider(): string {
  const src = readRepoFile('src/providers/markdown-editor-provider.ts');
  const match = src.match(/<div id="toolbar"[\s\S]*?<\/div>\s*<div id="link-input-bar"/);
  assert.ok(match, '#toolbar HTML block must exist in markdown-editor-provider');
  return match[0];
}

function getSerializerExport(name: string): ((doc: TipTapDoc, ...args: unknown[]) => TipTapDoc) | undefined {
  const fn = (serializer as Record<string, unknown>)[name];
  return typeof fn === 'function'
    ? (fn as (doc: TipTapDoc, ...args: unknown[]) => TipTapDoc)
    : undefined;
}

suite('GFM format toolbar (TC-107–123)', () => {
  // --- P0: serializer round-trips ---

  test('TC-107: strike ~~hello~~ round-trips without del or s tags', () => {
    const md = '~~hello~~\n';
    const doc = parseMarkdown(md);
    assert.ok(docHasMark(doc, 'strike'), 'parse must attach strike mark to hello');
    const texts = collectTextNodes(doc.content[0] ?? { type: 'paragraph' });
    assert.ok(
      texts.some((t) => t.text === 'hello' && hasMark(t, 'strike')),
      'text hello must carry strike',
    );

    const out = serializeMarkdown(doc);
    assert.ok(/~~hello~~/.test(out), `serialize must emit ~~hello~~, got ${JSON.stringify(out)}`);
    assert.ok(!/<(del|s)\b/i.test(out), 'must not emit <del> or <s>');

    const again = parseMarkdown(out);
    assert.ok(docHasMark(again, 'strike'), 'round-trip must keep strike meaning');
  });

  test('TC-108: H3 toggle then paragraph then H6 serializes and toolbar exposes H3–H6', () => {
    const applyToggleHeading = getSerializerExport('applyToggleHeading');
    assert.ok(
      applyToggleHeading,
      'applyToggleHeading export required for TipTap heading toggle unit (TC-108)',
    );

    let doc: TipTapDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    };
    doc = applyToggleHeading!(doc, 3);
    assert.strictEqual(doc.content[0]?.type, 'heading');
    assert.strictEqual(doc.content[0]?.attrs?.level, 3);
    assert.ok(/^### Hello/m.test(serializeMarkdown(doc)));

    doc = applyToggleHeading!(doc, 3);
    assert.strictEqual(doc.content[0]?.type, 'paragraph', 'same-level re-toggle must become paragraph');
    assert.ok(!/^#/m.test(serializeMarkdown(doc).trim()));

    doc = applyToggleHeading!(doc, 6);
    assert.strictEqual(doc.content[0]?.attrs?.level, 6);
    assert.ok(/^###### Hello/m.test(serializeMarkdown(doc)));

    const html = formatToolbarHtmlFromProvider();
    for (const level of [3, 4, 5, 6]) {
      assert.ok(
        html.includes(`data-cmd="heading"`) && html.includes(`data-level="${level}"`),
        `toolbar must expose H${level}`,
      );
    }
  });

  test('TC-109: inlineCode vs codeBlock stay distinct; code wins over strike', () => {
    const applyInlineCode = getSerializerExport('applyToggleInlineCode');
    const applyCodeBlock = getSerializerExport('applyToggleCodeBlock');
    assert.ok(applyInlineCode, 'applyToggleInlineCode export required for TC-109');
    assert.ok(applyCodeBlock, 'applyToggleCodeBlock export required for TC-109');

    let inlineDoc: TipTapDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'foo' }] }],
    };
    inlineDoc = applyInlineCode!(inlineDoc);
    const inlineOut = serializeMarkdown(inlineDoc);
    assert.ok(/`foo`/.test(inlineOut), `inlineCode must serialize as \`foo\`, got ${JSON.stringify(inlineOut)}`);
    assert.ok(!/```/.test(inlineOut), 'inlineCode must not emit a fence');

    let blockDoc: TipTapDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bar' }] }],
    };
    blockDoc = applyCodeBlock!(blockDoc);
    const blockOut = serializeMarkdown(blockDoc);
    assert.ok(/```/.test(blockOut), 'codeBlock must serialize as fenced block');
    assert.ok(blockOut.includes('bar'));
    assert.ok(!/^`bar`$/m.test(blockOut.trim()), 'codeBlock must not be inline-only');

    const codeWithTildes = parseMarkdown('`~~notstrike~~`\n');
    assert.ok(docHasMark(codeWithTildes, 'code'), 'inline code must parse as code mark');
    assert.ok(
      !docHasMark(codeWithTildes, 'strike'),
      '~~ inside inline code must not become strike (code wins)',
    );

    const html = formatToolbarHtmlFromProvider();
    assert.ok(html.includes('data-cmd="inlineCode"'), 'toolbar must expose inlineCode');
    assert.ok(html.includes('data-cmd="codeBlock"'), 'toolbar must keep codeBlock');
    assert.ok(html.includes('title="Code Block"'), 'Code Block title must remain');
  });

  test('TC-110: blockquote keeps non-paragraph children on round-trip', () => {
    const md = [
      '> # Title',
      '>',
      '> - item',
      '>',
      '> - [ ] task',
      '>',
      '> ```',
      '> code',
      '> ```',
      '>',
      '> > nested',
      '',
    ].join('\n');

    const doc = parseMarkdown(md);
    const quote = findNode(doc, 'blockquote');
    assert.ok(quote, 'must parse blockquote');
    const childTypes = new Set((quote?.content ?? []).map((c) => c.type));
    assert.ok(childTypes.has('heading'), 'blockquote must keep heading child');
    assert.ok(
      childTypes.has('bulletList') || childTypes.has('taskList'),
      'blockquote must keep list/taskList child',
    );
    assert.ok(childTypes.has('codeBlock'), 'blockquote must keep codeBlock child');
    assert.ok(childTypes.has('blockquote'), 'blockquote must keep nested blockquote');

    const out = serializeMarkdown(doc);
    assert.ok(/^>/m.test(out), 'serialize must keep GFM > prefixes');
    assert.ok(/#\s*Title/.test(out), 'heading must survive serialize');
    assert.ok(/item/.test(out), 'list item must survive');
    assert.ok(/task/.test(out), 'task text must survive');
    assert.ok(/```/.test(out) && /code/.test(out), 'codeBlock must survive');
    assert.ok(/nested/.test(out), 'nested quote text must survive');
  });

  test('TC-111: task list round-trips with normalized checkbox markers', () => {
    const md = '- [ ] open\n- [x] done\n- [X] upper\n';
    const doc = parseMarkdown(md);
    const taskList = findNode(doc, 'taskList');
    assert.ok(taskList, 'must parse as taskList');
    const items = taskList?.content ?? [];
    assert.ok(items.every((i) => i.type === 'taskItem'), 'children must be taskItem');
    assert.strictEqual(items[0]?.attrs?.checked, false);
    assert.strictEqual(items[1]?.attrs?.checked, true);
    assert.strictEqual(items[2]?.attrs?.checked, true, '[X] must parse as checked');

    const out = serializeMarkdown(doc);
    assert.ok(/- \[ \] open/.test(out), `open item: ${JSON.stringify(out)}`);
    assert.ok(/- \[x\] done/.test(out), `done item lowercase x: ${JSON.stringify(out)}`);
    assert.ok(/- \[x\] upper/.test(out), `[X] must normalize to [x]: ${JSON.stringify(out)}`);
    assert.ok(!/^\d+\.\s/m.test(out), 'must not become ordered list');

    const toggleTaskChecked = getSerializerExport('toggleTaskItemChecked');
    assert.ok(toggleTaskChecked, 'toggleTaskItemChecked export required for checkbox dirty edit');
    const toggled = toggleTaskChecked!(doc, 0);
    assert.strictEqual(findNode(toggled, 'taskList')?.content?.[0]?.attrs?.checked, true);
  });

  test('TC-112: task list exclusive with bullet and ordered (checked dropped)', () => {
    const convertExclusiveList = getSerializerExport('convertExclusiveList');
    assert.ok(
      convertExclusiveList,
      'convertExclusiveList export required for TipTap list exclusivity (TC-112)',
    );

    const taskDoc: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }],
            },
          ],
        },
      ],
    };

    const asBullet = convertExclusiveList!(taskDoc, 'bulletList');
    assert.strictEqual(asBullet.content[0]?.type, 'bulletList');
    assert.ok(
      (asBullet.content[0]?.content ?? []).every((i) => i.type === 'listItem'),
      'bullet conversion must use listItem only',
    );
    assert.ok(
      !(asBullet.content[0]?.content ?? []).some((i) => i.attrs?.checked != null),
      'checked must be dropped on Bullet',
    );
    const bulletOut = serializeMarkdown(asBullet);
    assert.ok(/- done/.test(bulletOut));
    assert.ok(!/\[x\]|\[ \]/.test(bulletOut), 'checkbox markers must not remain');

    const asOrdered = convertExclusiveList!(taskDoc, 'orderedList');
    assert.strictEqual(asOrdered.content[0]?.type, 'orderedList');
    assert.ok(
      !(asOrdered.content[0]?.content ?? []).some((i) => i.attrs?.checked != null),
      'checked must be dropped on Ordered',
    );

    const bulletDoc: TipTapDoc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }],
            },
          ],
        },
      ],
    };
    const asTask = convertExclusiveList!(bulletDoc, 'taskList');
    assert.strictEqual(asTask.content[0]?.type, 'taskList');
    assert.ok((asTask.content[0]?.content ?? []).every((i) => i.type === 'taskItem'));
    assert.ok(/- \[ \] a/.test(serializeMarkdown(asTask)), 'Task must become unordered - [ ]');
  });

  test('TC-113: thematicBreak --- round-trips and HR insert is not a toggle', () => {
    const md = 'a\n\n---\n\nb\n';
    const doc = parseMarkdown(md);
    assert.ok(findNode(doc, 'horizontalRule'), '--- must parse as horizontalRule');
    const out = roundTrip(md);
    assert.ok(/---/.test(out), `serialize must emit ---, got ${JSON.stringify(out)}`);
    assert.strictEqual(normalizeMd(out).includes('---'), true);

    const insertHorizontalRule = getSerializerExport('insertHorizontalRule');
    assert.ok(insertHorizontalRule, 'insertHorizontalRule export required for TC-113');

    let withHr: TipTapDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }],
    };
    withHr = insertHorizontalRule!(withHr);
    withHr = insertHorizontalRule!(withHr);
    const hrs = withHr.content.filter((n) => n.type === 'horizontalRule');
    assert.strictEqual(hrs.length, 2, 'second insert must add another HR (not toggle-delete)');
    const hrOut = serializeMarkdown(withHr);
    assert.strictEqual((hrOut.match(/---/g) ?? []).length, 2);

    const html = formatToolbarHtmlFromProvider();
    assert.ok(html.includes('data-cmd="horizontalRule"'), 'toolbar must expose horizontalRule');
  });

  // --- P1 ---

  test('TC-114: readonly disables new format controls and task checkbox', () => {
    assert.strictEqual(canEditContent('markdown', true), false);
    assert.strictEqual(isVisualSurfaceReadOnly('markdown', true), true);

    const css = readRepoFile('media/editor.css');
    assert.ok(
      /body\[data-readonly=['"]true['"]\]\s*#toolbar[\s\S]*?pointer-events:\s*none/.test(css),
      '#toolbar must use pointer-events none under file RO',
    );

    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /readonly/.test(editorSrc) && /data-cmd|attachToolbarHandlers/.test(editorSrc),
      'toolbar handlers must guard readonly',
    );
    // New In commands and task checkbox must respect the same RO guard (no Document mutation path).
    for (const cmd of ['strike', 'inlineCode', 'taskList', 'blockquote', 'horizontalRule']) {
      assert.ok(
        editorSrc.includes(`'${cmd}'`) || editorSrc.includes(`"${cmd}"`),
        `editor must wire data-cmd ${cmd} behind RO guard`,
      );
    }
  });

  test('TC-115: Preview hides format toolbar; Raw keeps toolbar but format commands no-op', () => {
    assert.strictEqual(acceptsWebviewContentUpdate('preview'), false);
    assert.strictEqual(canEditContent('preview', false), false);

    const css = readRepoFile('media/editor.css');
    assert.ok(
      /body\[data-mode=['"]preview['"]\]\s*#toolbar[\s\S]*?display:\s*none/.test(css),
      'Preview must hide #toolbar',
    );
    assert.ok(
      !/body\[data-mode=['"]raw['"]\]\s*#toolbar[\s\S]*?display:\s*none/.test(css),
      'Raw must not hide #toolbar',
    );

    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /editorMode\s*!==\s*['"]markdown['"]/.test(editorSrc) ||
        /editorMode\s*===\s*['"]markdown['"]/.test(editorSrc),
      'format commands must no-op unless Markdown mode',
    );
  });

  test('TC-116: numbered task list normalizes to unordered on serialize', () => {
    const md = '1. [ ] a\n2. [x] b\n';
    const doc = parseMarkdown(md);
    const taskList = findNode(doc, 'taskList');
    assert.ok(taskList, '1. [ ] must parse as taskList (unordered)');
    const out = serializeMarkdown(doc);
    assert.ok(/- \[ \] a/.test(out), `must emit - [ ] a, got ${JSON.stringify(out)}`);
    assert.ok(/- \[x\] b/.test(out), `must emit - [x] b, got ${JSON.stringify(out)}`);
    assert.ok(!/^\d+\.\s*\[/m.test(out), 'must not keep ordered task markers');
  });

  test('TC-117: HTML del and s normalize to GFM strike on serialize', () => {
    const md = '<del>x</del>\n\n<s>y</s>\n';
    const doc = parseMarkdown(md);
    assert.ok(docHasMark(doc, 'strike'), 'del/s must become strike in the model');
    const out = serializeMarkdown(doc);
    assert.ok(/~~x~~/.test(out), `must emit ~~x~~, got ${JSON.stringify(out)}`);
    assert.ok(/~~y~~/.test(out), `must emit ~~y~~, got ${JSON.stringify(out)}`);
    assert.ok(!/<(del|s)\b/i.test(out), 'must not re-emit <del> or <s>');
  });

  test('TC-118: compound strike+bold marks keep meaning either nest order', () => {
    const nestedStrikeOuter = parseMarkdown('~~**bold**~~\n');
    const nestedBoldOuter = parseMarkdown('**~~bold~~**\n');
    assert.ok(docHasMark(nestedStrikeOuter, 'strike'), '~~**bold**~~ must have strike');
    assert.ok(docHasMark(nestedStrikeOuter, 'bold'), '~~**bold**~~ must have bold');
    assert.ok(docHasMark(nestedBoldOuter, 'strike'), '**~~bold~~** must have strike');
    assert.ok(docHasMark(nestedBoldOuter, 'bold'), '**~~bold~~** must have bold');

    for (const doc of [nestedStrikeOuter, nestedBoldOuter]) {
      const out = serializeMarkdown(doc);
      assert.ok(/bold/.test(out), 'text must survive');
      assert.ok(/~~/.test(out), 'strike must serialize');
      assert.ok(/\*\*|__/.test(out), 'bold must serialize');
      const again = parseMarkdown(out);
      assert.ok(docHasMark(again, 'strike') && docHasMark(again, 'bold'), 'meaning must round-trip');
    }
  });

  test('TC-119: sanitize allows del and s, strips mark and script', () => {
    const input = '<p><del>x</del><s>y</s><mark>z</mark><script>alert(1)</script></p>';
    const result = sanitizeHtml(input);
    assert.ok(/<del\b/i.test(result), `del must remain allowed, got ${JSON.stringify(result)}`);
    assert.ok(/<s\b/i.test(result), `s must remain allowed, got ${JSON.stringify(result)}`);
    assert.ok(!/<mark\b/i.test(result), 'mark must not be allowlisted');
    assert.ok(!/<script\b/i.test(result), 'script must be removed');
    assert.ok(result.includes('x') && result.includes('y'));
  });

  test('TC-120: format toolbar exposes role toolbar and aria-pressed on toggles not HR', () => {
    const html = formatToolbarHtmlFromProvider();
    assert.ok(/id="toolbar"[^>]*role="toolbar"/.test(html) || /role="toolbar"[^>]*id="toolbar"/.test(html) ||
      /<div id="toolbar" role="toolbar"/.test(html),
      '#toolbar must have role="toolbar"');
    assert.ok(
      html.includes('aria-label="Formatting"'),
      '#toolbar must have aria-label="Formatting"',
    );

    for (const cmd of ['strike', 'inlineCode', 'taskList', 'blockquote']) {
      assert.ok(html.includes(`data-cmd="${cmd}"`), `toggle ${cmd} button required`);
    }
    assert.ok(
      /data-cmd="heading"[^>]*data-level="3"|data-level="3"[^>]*data-cmd="heading"/.test(html),
      'H3 toggle required for aria-pressed surface',
    );

    const hrBtn = html.match(/<button[^>]*data-cmd="horizontalRule"[^>]*>/);
    assert.ok(hrBtn, 'HR button required');
    assert.ok(
      !/aria-pressed/.test(hrBtn![0]),
      'HR is insert-only and must not declare aria-pressed on the button markup',
    );

    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /aria-pressed/.test(editorSrc),
      'editor must sync aria-pressed with selection for toggle commands',
    );
  });

  test('TC-121: single tilde does not become strike', () => {
    const doc = parseMarkdown('~notstrike~\nand a lone ~ tilde\n');
    assert.ok(!docHasMark(doc, 'strike'), 'single ~ must not create strike marks');
    const out = serializeMarkdown(doc);
    assert.ok(out.includes('~notstrike~') || out.includes('notstrike'), 'literal tilde text kept');
    assert.ok(!/~~notstrike~~/.test(out), 'must not upgrade to GFM strike');
  });

  test('TC-122: no new format keybindings; Strike and Blockquote defaults disabled', () => {
    const pkg = JSON.parse(readRepoFile('package.json')) as {
      contributes?: { keybindings?: unknown[] };
    };
    const keybindings = pkg.contributes?.keybindings ?? [];
    assert.strictEqual(
      keybindings.length,
      0,
      'must not add contributes.keybindings for new format commands',
    );

    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /Strike|strike/.test(editorSrc),
      'Strike extension must be configured in editor',
    );
    assert.ok(
      /Mod-Shift-s|enableInputRules|keyboardShortcuts|addKeyboardShortcuts/.test(editorSrc),
      'Strike default Mod-Shift-s must be disabled explicitly',
    );
    assert.ok(
      /Blockquote|blockquote/.test(editorSrc) &&
        /Mod-Shift-b|keyboardShortcuts|addKeyboardShortcuts/.test(editorSrc),
      'Blockquote default Mod-Shift-b must be disabled explicitly',
    );
    assert.ok(
      !/horizontalRule.*Mod-|Mod-.*horizontalRule|taskList.*Mod-|Mod-.*taskList/.test(editorSrc),
      'HR / Task must not gain new shortcuts',
    );
  });

  test('TC-123: format toolbar has four visual groups and required labels without Out buttons', () => {
    const html = formatToolbarHtmlFromProvider();
    assert.ok(html.includes('data-cmd="strike"'), 'Strike button');
    assert.ok(/title="Strikethrough"/.test(html), 'Strike title');
    assert.ok(/>\s*S\s*</.test(html) || /line-through/.test(html), 'Strike visible S / line-through');

    for (const level of [1, 2, 3, 4, 5, 6]) {
      assert.ok(html.includes(`data-level="${level}"`), `H${level} required`);
    }

    assert.ok(html.includes('data-cmd="inlineCode"'), 'Inline Code');
    assert.ok(html.includes('title="Inline Code"'), 'Inline Code title');
    assert.ok(html.includes('data-cmd="taskList"'), 'Task');
    assert.ok(html.includes('title="Task List"'), 'Task title');
    assert.ok(html.includes('data-cmd="blockquote"'), 'Quote');
    assert.ok(html.includes('title="Blockquote"'), 'Quote title');
    assert.ok(html.includes('data-cmd="horizontalRule"'), 'HR');
    assert.ok(html.includes('title="Horizontal rule"'), 'HR title');
    assert.ok(/―|&mdash;|&#8212;/.test(html) || html.includes('Horizontal rule'), 'HR label ―');

    assert.ok(html.includes('data-cmd="codeBlock"'), 'existing Code Block kept');
    assert.ok(html.includes('title="Code Block"'), 'Code Block title kept');

    assert.ok(
      !/data-cmd="image"|title="Image"|data-cmd="underline"|data-cmd="highlight"/.test(html),
      'Out: no image / underline / highlight buttons',
    );

    const separators = (html.match(/toolbar-sep|toolbar-separator|class="[^"]*sep[^"]*"/g) ?? []).length;
    assert.ok(
      separators >= 3 || (html.match(/<hr\b/g) ?? []).length >= 3,
      'visual separators for 4 groups required',
    );
  });
});
