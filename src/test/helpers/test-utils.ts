import * as fs from 'fs';
import * as path from 'path';

/**
 * リポジトリルート基準のファイルパスを解決してUTF-8テキストとして読み込む
 */
export function readRepoFile(...parts: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), ...parts), 'utf8');
}

/**
 * out/utils/${moduleName}.js を require してモジュールオブジェクトを返す
 */
export function loadCompiledUtil(moduleName: string): Record<string, unknown> {
  const jsPath = path.resolve(process.cwd(), `out/utils/${moduleName}.js`);
  if (!fs.existsSync(jsPath)) {
    return {};
  }
  return require(jsPath) as Record<string, unknown>;
}

/**
 * コンパイル済みユーティリティモジュールから特定のエクスポート関数を取得する
 */
export function getUtilExport<T>(moduleName: string, exportName: string): T | undefined {
  const mod = loadCompiledUtil(moduleName);
  const fn = mod[exportName];
  return typeof fn === 'function' ? (fn as T) : undefined;
}

/**
 * 指定時間（ミリ秒）スリープする
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 指定の条件関数が true を返すまでポーリング待機する（タイムアウト付き）
 */
export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 50
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await sleep(intervalMs);
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

/**
 * JSDOM と DOMPurify を用いて安全に SVG をサニタイズする。
 * globalThis.window および document の汚染を finally 句で確実に退避・復元する。
 */
export function safeSanitizeSvg(svg: string, options?: Record<string, unknown>): string {
  const { JSDOM } = require('jsdom') as {
    JSDOM: new (html: string) => { window: object & { document: object } };
  };
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const originalWindow = (globalThis as Record<string, unknown>).window;
  const originalDocument = (globalThis as Record<string, unknown>).document;
  try {
    (globalThis as Record<string, unknown>).window = dom.window;
    (globalThis as Record<string, unknown>).document = dom.window.document;
    const createDOMPurify = require('dompurify') as (
      win: object
    ) => { sanitize: (dirty: string, cfg?: Record<string, unknown>) => string };
    const purify = createDOMPurify(dom.window);
    return purify.sanitize(svg, options);
  } finally {
    if (originalWindow !== undefined) {
      (globalThis as Record<string, unknown>).window = originalWindow;
    } else {
      delete (globalThis as Record<string, unknown>).window;
    }
    if (originalDocument !== undefined) {
      (globalThis as Record<string, unknown>).document = originalDocument;
    } else {
      delete (globalThis as Record<string, unknown>).document;
    }
  }
}
