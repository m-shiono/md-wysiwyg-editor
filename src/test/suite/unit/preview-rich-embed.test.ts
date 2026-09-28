/**
 * TC-124–142: preview-rich-embed contracts (TDD Red).
 * Production helpers / Webview wiring may be absent until build-agent implements Green.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { isSafeImagePath } from '../../../utils/image-numbering';
import { docToJson, parseMarkdown, serializeMarkdown } from '../../../serializers/markdown-serializer';
type PreviewProjectionMessage = { type: string; html?: string; docJson?: string; markdownText?: string };

function readRepoFile(...parts: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), ...parts), 'utf8');
}

function loadCompiledUtil(moduleName: string): Record<string, unknown> {
  const jsPath = path.resolve(process.cwd(), `out/utils/${moduleName}.js`);
  if (!fs.existsSync(jsPath)) {
    return {};
  }
  return require(jsPath) as Record<string, unknown>;
}

function getUtilExport<T>(moduleName: string, exportName: string): T | undefined {
  const mod = loadCompiledUtil(moduleName);
  const fn = mod[exportName];
  return typeof fn === 'function' ? (fn as T) : undefined;
}

function createMockWebview(): { asWebviewUri: (uri: vscode.Uri) => vscode.Uri } {
  return {
    asWebviewUri: (uri: vscode.Uri) =>
      vscode.Uri.parse(`vscode-webview://authority${uri.fsPath.replace(/\\/g, '/')}`),
  };
}

const MARP_FIXTURE = [
  '---',
  'marp: true',
  '---',
  '',
  '# Slide 1',
  '',
  '---',
  '',
  '# Slide 2',
  '',
].join('\n');

const NON_MARP_FIXTURE = '# Hello\n\nPlain markdown.\n';

const DIVERGENT_MARP_FIXTURE = [
  '---',
  'marp: true',
  '---',
  '',
  '# From markdownText',
  '',
  '---',
  '',
  '# Slide 2',
  '',
].join('\n');

suite('preview-rich-embed (TC-124–142)', () => {
  // --- Image URI rewrite (TC-124–129) ---

  test('TC-124: applyDisplayUriRewrite rewrites init and docUpdated docJson for Markdown projection', () => {
    const applyDisplayUriRewrite = getUtilExport<
      (
        message: PreviewProjectionMessage & { type: string; readonly?: boolean; uri?: string; editorMode?: string; relativePath?: string },
        mdUri: vscode.Uri,
        webview: { asWebviewUri: (uri: vscode.Uri) => vscode.Uri },
      ) => PreviewProjectionMessage
    >('preview-projection', 'applyDisplayUriRewrite');
    assert.ok(applyDisplayUriRewrite, 'applyDisplayUriRewrite export required');

    const mdUri = vscode.Uri.file('/workspace/docs/readme.md');
    const doc = parseMarkdown('![diagram](img/image-0001.png)\n');
    const docJson = docToJson(doc);
    const markdownText = serializeMarkdown(doc);
    const webview = createMockWebview();

    const initMessage = applyDisplayUriRewrite!(
      {
        type: 'init',
        docJson,
        markdownText,
        readonly: false,
        uri: mdUri.toString(),
        editorMode: 'markdown',
      },
      mdUri,
      webview,
    );
    assert.strictEqual(initMessage.type, 'init');
    assert.ok(
      initMessage.docJson?.includes('vscode-webview://'),
      'init docJson must use webview URI for display',
    );
    assert.ok(
      !initMessage.docJson?.includes('img/image-0001.png'),
      'init docJson must not keep raw relative path',
    );

    const docUpdatedMessage = applyDisplayUriRewrite!(
      { type: 'docUpdated', docJson, markdownText },
      mdUri,
      webview,
    );
    assert.strictEqual(docUpdatedMessage.type, 'docUpdated');
    assert.ok(
      docUpdatedMessage.docJson?.includes('vscode-webview://'),
      'docUpdated docJson must use webview URI for display',
    );
    assert.ok(
      !docUpdatedMessage.docJson?.includes('img/image-0001.png'),
      'docUpdated docJson must not keep raw relative path',
    );
  });

  test('TC-124: imageInserted relativePath rewrites to webview URI for immediate display', () => {
    const applyDisplayUriRewrite = getUtilExport<
      (
        message: { type: string; relativePath: string },
        mdUri: vscode.Uri,
        webview: { asWebviewUri: (uri: vscode.Uri) => vscode.Uri },
      ) => { type: string; relativePath: string }
    >('preview-projection', 'applyDisplayUriRewrite');
    assert.ok(applyDisplayUriRewrite, 'applyDisplayUriRewrite export required');

    const mdUri = vscode.Uri.file('/workspace/docs/readme.md');
    const webview = createMockWebview();
    const message = applyDisplayUriRewrite!(
      { type: 'imageInserted', relativePath: 'img/image-0001.png' },
      mdUri,
      webview,
    );

    assert.strictEqual(message.type, 'imageInserted');
    assert.ok(
      message.relativePath.includes('vscode-webview://'),
      'imageInserted must send webview URI for TipTap display',
    );
    assert.ok(
      !message.relativePath.includes('img/image-0001.png'),
      'imageInserted must not send raw relative path to webview',
    );
  });

  test('TC-124: docJson image.src rewrites to webview URI while Document keeps relative path', () => {
    const rewriteImageUrisInDocJson = getUtilExport<
      (
        docJson: string,
        mdUri: vscode.Uri,
        webview: { asWebviewUri: (uri: vscode.Uri) => vscode.Uri },
      ) => string
    >('image-uri-rewrite', 'rewriteImageUrisInDocJson');
    assert.ok(rewriteImageUrisInDocJson, 'rewriteImageUrisInDocJson export required (TC-124)');

    const mdUri = vscode.Uri.file('/workspace/docs/readme.md');
    const doc = parseMarkdown('![diagram](img/image-0001.png)\n');
    const originalDocJson = docToJson(doc);
    assert.ok(originalDocJson.includes('img/image-0001.png'), 'fixture must use img/ relative path');

    const webview = createMockWebview();
    const projected = rewriteImageUrisInDocJson!(originalDocJson, mdUri, webview);

    assert.ok(
      projected.includes('vscode-webview://'),
      `projected docJson must use asWebviewUri result, got ${projected}`,
    );
    assert.ok(!projected.includes('img/image-0001.png'), 'projected docJson must not keep raw relative path');
    assert.ok(
      originalDocJson.includes('img/image-0001.png'),
      'original Document docJson must remain relative path',
    );
  });

  test('TC-125: serialize after webview projection keeps img/ relative path on disk', () => {
    const rewriteImageUrisInDocJson = getUtilExport<
      (
        docJson: string,
        mdUri: vscode.Uri,
        webview: { asWebviewUri: (uri: vscode.Uri) => vscode.Uri },
      ) => string
    >('image-uri-rewrite', 'rewriteImageUrisInDocJson');
    assert.ok(rewriteImageUrisInDocJson, 'rewriteImageUrisInDocJson export required (TC-125)');

    const mdUri = vscode.Uri.file('/workspace/docs/readme.md');
    const doc = parseMarkdown('![logo](img/image-0001.png)\n');
    const docJson = docToJson(doc);
    const webview = createMockWebview();

    rewriteImageUrisInDocJson!(docJson, mdUri, webview);
    const serialized = serializeMarkdown(doc);
    assert.ok(
      /!\[[^\]]*\]\(img\/image-0001\.png\)/.test(serialized),
      `serialize must keep relative path, got ${JSON.stringify(serialized)}`,
    );
    assert.ok(!serialized.includes('vscode-webview://'), 'serialize must not contain webview URI');
  });

  test('TC-126: isSafeImagePath allows img/ only and rejects traversal and non-img paths', () => {
    const mdUri = 'file:///workspace/doc.md';
    assert.strictEqual(isSafeImagePath(mdUri, 'img/image-0001.png'), true);
    assert.strictEqual(isSafeImagePath(mdUri, 'assets/logo.png'), false);
    assert.strictEqual(isSafeImagePath(mdUri, '../evil.png'), false);
    assert.strictEqual(isSafeImagePath(mdUri, 'img/../other.png'), false);
  });

  test('TC-127: unsafe image paths skip Host rewrite in docJson projection', () => {
    const rewriteImageUrisInDocJson = getUtilExport<
      (
        docJson: string,
        mdUri: vscode.Uri,
        webview: { asWebviewUri: (uri: vscode.Uri) => vscode.Uri },
      ) => string
    >('image-uri-rewrite', 'rewriteImageUrisInDocJson');
    assert.ok(rewriteImageUrisInDocJson, 'rewriteImageUrisInDocJson export required (TC-127)');

    const mdUri = vscode.Uri.file('/workspace/docs/readme.md');
    const doc = parseMarkdown('![logo](assets/logo.png)\n');
    const docJson = docToJson(doc);
    const projected = rewriteImageUrisInDocJson!(docJson, mdUri, createMockWebview());

    assert.ok(projected.includes('assets/logo.png'), 'unsafe path must not be rewritten');
    assert.ok(!projected.includes('vscode-webview://'), 'unsafe path must not become webview URI');
  });

  test('TC-128: Marp HTML img src rewrites to webview URI in previewMarpHtml payload', () => {
    const rewriteImageUrisInHtml = getUtilExport<
      (
        html: string,
        mdUri: vscode.Uri,
        webview: { asWebviewUri: (uri: vscode.Uri) => vscode.Uri },
      ) => string
    >('image-uri-rewrite', 'rewriteImageUrisInHtml');
    assert.ok(rewriteImageUrisInHtml, 'rewriteImageUrisInHtml export required (TC-128)');

    const mdUri = vscode.Uri.file('/workspace/slides/deck.md');
    const html = '<section><img src="img/slide.png" alt="slide" /></section>';
    const rewritten = rewriteImageUrisInHtml!(html, mdUri, createMockWebview());

    assert.ok(rewritten.includes('vscode-webview://'), 'Marp HTML img src must rewrite');
    assert.ok(!rewritten.includes('src="img/slide.png"'), 'raw img/ path must not remain in HTML');
  });

  test('TC-129: https and data image URIs pass through without Host rewrite', () => {
    const rewriteImageUrisInDocJson = getUtilExport<
      (
        docJson: string,
        mdUri: vscode.Uri,
        webview: { asWebviewUri: (uri: vscode.Uri) => vscode.Uri },
      ) => string
    >('image-uri-rewrite', 'rewriteImageUrisInDocJson');
    assert.ok(rewriteImageUrisInDocJson, 'rewriteImageUrisInDocJson export required (TC-129)');

    const mdUri = vscode.Uri.file('/workspace/docs/readme.md');
    const webview = createMockWebview();
    const httpsDoc = docToJson(parseMarkdown('![remote](https://example.com/a.png)\n'));
    const dataDoc = docToJson(
      parseMarkdown('![inline](data:image/png;base64,iVBORw0KGgo=)\n'),
    );

    const httpsProjected = rewriteImageUrisInDocJson!(httpsDoc, mdUri, webview);
    const dataProjected = rewriteImageUrisInDocJson!(dataDoc, mdUri, webview);

    assert.ok(httpsProjected.includes('https://example.com/a.png'));
    assert.ok(!httpsProjected.includes('vscode-webview://'));
    assert.ok(dataProjected.includes('data:image/png;base64,'));
    assert.ok(!dataProjected.includes('vscode-webview://'));
  });

  // --- Preview Mermaid CSS (TC-130–132) — snap-style: source visible in Preview ---

  test('TC-130: Preview mode shows mermaid-source and mermaid-preview', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !/body\[data-mode=['"]preview['"]\][\s\S]*\.mermaid-source[\s\S]*display:\s*none/.test(css),
      'Preview must not hide .mermaid-source via CSS (source co-display; old hide withdrawn)',
    );
    assert.ok(
      !/body\[data-mode=['"]preview['"]\][\s\S]*\.mermaid-preview[\s\S]*display:\s*none/.test(css),
      'Preview must not hide .mermaid-preview',
    );
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(editorSrc.includes('mermaid-source'), 'NodeView must render mermaid-source');
    assert.ok(editorSrc.includes('mermaid-preview'), 'NodeView must render mermaid-preview');
  });

  test('TC-131: Markdown mode keeps mermaid-source and mermaid-preview visible', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !/body\[data-mode=['"]markdown['"]\][\s\S]*\.mermaid-source[\s\S]*display:\s*none/.test(css),
      'Markdown must not hide .mermaid-source',
    );
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(editorSrc.includes('mermaid-source'), 'NodeView must render mermaid-source');
    assert.ok(editorSrc.includes('mermaid-preview'), 'NodeView must render mermaid-preview');
  });

  test('TC-132: Preview mermaid syntax error shows preview error while source stays visible', () => {
    const css = readRepoFile('media/editor.css');
    assert.ok(
      !/body\[data-mode=['"]preview['"]\][\s\S]*\.mermaid-source[\s\S]*display:\s*none/.test(css),
      'Preview must not hide mermaid-source on syntax error',
    );
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(editorSrc.includes('mermaid-error'), 'invalid mermaid must render error in preview area');
  });

  // --- isMarpDocument shared util (TC-133) ---

  test('TC-133: Preview and Marp panel share the same exported isMarpDocument', () => {
    const marpPreviewSrc = readRepoFile('src/commands/marp-preview.ts');
    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');

    const sharedExport =
      /export\s+function\s+isMarpDocument\b/.test(marpPreviewSrc) ||
      fs.existsSync(path.resolve(process.cwd(), 'src/utils/is-marp-document.ts'));
    assert.ok(sharedExport, 'isMarpDocument must be exported from shared util');

    const importPattern =
      /from\s+['"]\.\.\/utils\/is-marp-document['"]/.test(providerSrc) ||
      /from\s+['"]\.\.\/commands\/marp-preview['"]/.test(providerSrc);
    assert.ok(importPattern, 'markdown-editor-provider must import shared isMarpDocument');

    const isMarpDocument = getUtilExport<(content: string) => boolean>(
      fs.existsSync(path.resolve(process.cwd(), 'src/utils/is-marp-document.ts'))
        ? 'is-marp-document'
        : 'marp-preview',
      'isMarpDocument',
    );
    assert.ok(isMarpDocument, 'isMarpDocument export required for runtime check');

    assert.strictEqual(isMarpDocument!(MARP_FIXTURE), true);
    assert.strictEqual(isMarpDocument!(NON_MARP_FIXTURE), false);
  });

  // --- Preview Marp branch logic (TC-134–142) ---

  test('TC-134: Preview + Marp shows #preview-marp-root and hides #editor', () => {
    const resolvePreviewSurface = getUtilExport<
      (editorMode: string, markdownText: string) => 'tiptap' | 'marp'
    >('preview-projection', 'resolvePreviewSurface');
    assert.ok(resolvePreviewSurface, 'resolvePreviewSurface export required (TC-134)');
    assert.strictEqual(resolvePreviewSurface!('preview', MARP_FIXTURE), 'marp');

    const providerHtml = readRepoFile('src/providers/markdown-editor-provider.ts');
    assert.ok(
      providerHtml.includes('id="preview-marp-root"'),
      'Custom Editor HTML must include #preview-marp-root',
    );

    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /preview-marp-root/.test(editorSrc) && /#editor/.test(editorSrc),
      'Webview must toggle #editor and #preview-marp-root for Marp Preview',
    );
  });

  test('TC-135: Preview + non-Marp keeps TipTap RO and empty marp root', () => {
    const resolvePreviewSurface = getUtilExport<
      (editorMode: string, markdownText: string) => 'tiptap' | 'marp'
    >('preview-projection', 'resolvePreviewSurface');
    assert.ok(resolvePreviewSurface, 'resolvePreviewSurface export required (TC-135)');
    assert.strictEqual(resolvePreviewSurface!('preview', NON_MARP_FIXTURE), 'tiptap');
    assert.strictEqual(resolvePreviewSurface!('markdown', MARP_FIXTURE), 'tiptap');
  });

  test('TC-136: previewMarpHtml message type and Webview DOM injection handler exist', () => {
    const messagesSrc = readRepoFile('src/webviews/messages.ts');
    assert.ok(
      /previewMarpHtml/.test(messagesSrc),
      'WebviewOutboundMessage must include previewMarpHtml',
    );

    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /case\s+['"]previewMarpHtml['"]/.test(editorSrc),
      'Webview message handler must handle previewMarpHtml',
    );
    assert.ok(
      /preview-marp-root/.test(editorSrc) && /innerHTML/.test(editorSrc),
      'previewMarpHtml must inject sanitized HTML into #preview-marp-root',
    );

    const sample: PreviewProjectionMessage = {
      type: 'previewMarpHtml',
      html: '<section>slide</section>',
    };
    assert.strictEqual(sample.type, 'previewMarpHtml');
  });

  test('TC-137: Marp preview projection uses markdownText only, not docJson', () => {
    const buildPreviewProjectionMessages = getUtilExport<
      (editorMode: string, docJson: string, markdownText: string) => PreviewProjectionMessage[]
    >('preview-projection', 'buildPreviewProjectionMessages');
    assert.ok(
      buildPreviewProjectionMessages,
      'buildPreviewProjectionMessages export required (TC-137)',
    );

    const divergentDocJson = docToJson(parseMarkdown('# Wrong TipTap title\n'));
    const messages = buildPreviewProjectionMessages!(
      'preview',
      divergentDocJson,
      DIVERGENT_MARP_FIXTURE,
    );

    const marpMsg = messages.find((m) => m.type === 'previewMarpHtml');
    assert.ok(marpMsg && 'html' in marpMsg, 'Marp preview must emit previewMarpHtml');
    assert.ok(
      (marpMsg as { html: string }).html.includes('From markdownText'),
      'Marp HTML must come from markdownText, not docJson',
    );
    assert.ok(
      !(marpMsg as { html: string }).html.includes('Wrong TipTap title'),
      'docJson must not drive Marp render input',
    );
  });

  test('TC-138: entering Preview does not auto-open Marp Preview panel', () => {
    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
    assert.ok(
      !/showMarpPreview|marpPreviewManager\.show/.test(
        providerSrc.match(/setMode|editorMode\s*===\s*['"]preview['"][\s\S]{0,400}/)?.[0] ?? '',
      ),
      'Preview mode switch must not auto-open Marp panel',
    );
  });

  test('TC-139: #preview-marp-root exposes document a11y attributes', () => {
    const providerHtml = readRepoFile('src/providers/markdown-editor-provider.ts');
    assert.ok(providerHtml.includes('id="preview-marp-root"'), 'preview marp root must exist in HTML');
    assert.ok(
      /id="preview-marp-root"[^>]*role="document"/.test(providerHtml) ||
        /role="document"[^>]*id="preview-marp-root"/.test(providerHtml),
      '#preview-marp-root must have role="document"',
    );
    assert.ok(
      /id="preview-marp-root"[^>]*aria-readonly="true"/.test(providerHtml) ||
        /aria-readonly="true"[^>]*id="preview-marp-root"/.test(providerHtml),
      '#preview-marp-root must have aria-readonly="true"',
    );
  });

  test('TC-140: leaving Preview clears marp root and restores #editor', () => {
    const editorSrc = readRepoFile('media/editor.ts');
    assert.ok(
      /preview-marp-root/.test(editorSrc) &&
        (/innerHTML\s*=\s*['"]['"]/.test(editorSrc) || /textContent\s*=\s*['"]['"]/.test(editorSrc)),
      'leaving Preview must clear #preview-marp-root',
    );
    assert.ok(
      /#editor/.test(editorSrc) && /classList\.(remove|toggle)\(['"]hidden['"]/.test(editorSrc),
      'leaving Preview must restore #editor visibility',
    );
  });

  test('TC-141: manual Marp panel coexists with Preview inline Marp', () => {
    const pkg = JSON.parse(readRepoFile('package.json')) as {
      contributes: { commands: Array<{ command: string }> };
    };
    assert.ok(
      pkg.contributes.commands.some((c) => c.command === 'md-wysiwyg-editor.showMarpPreview'),
      'showMarpPreview command must remain for panel coexistence',
    );

    const providerSrc = readRepoFile('src/providers/markdown-editor-provider.ts');
    assert.ok(
      providerSrc.includes('MarpPreviewManager'),
      'provider must keep MarpPreviewManager for panel path',
    );
    assert.ok(
      providerSrc.includes('preview-marp-root') || providerSrc.includes('previewMarpHtml'),
      'provider must also support inline Preview Marp path',
    );
  });

  test('TC-142: markdownText update re-evaluates Marp detection in Preview projection', () => {
    const buildPreviewProjectionMessages = getUtilExport<
      (editorMode: string, docJson: string, markdownText: string) => PreviewProjectionMessage[]
    >('preview-projection', 'buildPreviewProjectionMessages');
    assert.ok(
      buildPreviewProjectionMessages,
      'buildPreviewProjectionMessages export required (TC-142)',
    );

    const docJson = docToJson(parseMarkdown('# Title\n'));
    const marpMessages = buildPreviewProjectionMessages!('preview', docJson, MARP_FIXTURE);
    const plainMessages = buildPreviewProjectionMessages!('preview', docJson, NON_MARP_FIXTURE);

    assert.ok(
      marpMessages.some((m) => m.type === 'previewMarpHtml'),
      'Marp markdownText must emit previewMarpHtml',
    );
    assert.ok(
      !plainMessages.some((m) => m.type === 'previewMarpHtml'),
      'non-Marp markdownText must not emit previewMarpHtml',
    );
    assert.ok(
      plainMessages.some((m) => m.type === 'docUpdated' && 'docJson' in m),
      'non-Marp Preview must still project docJson',
    );
  });
});
