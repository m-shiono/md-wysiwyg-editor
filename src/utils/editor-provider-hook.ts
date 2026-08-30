import type { MarkdownEditorProvider } from '../providers/markdown-editor-provider';

const GLOBAL_KEY = '__vscMdEditorProvider';

type GlobalWithProvider = typeof globalThis & {
  [GLOBAL_KEY]?: MarkdownEditorProvider;
};

/** Called from activate so integration tests can drive the open custom editor. */
export function setMarkdownEditorProvider(provider: MarkdownEditorProvider): void {
  (globalThis as GlobalWithProvider)[GLOBAL_KEY] = provider;
}

/** Returns the active custom editor provider (integration tests). */
export function getMarkdownEditorProvider(): MarkdownEditorProvider | undefined {
  return (globalThis as GlobalWithProvider)[GLOBAL_KEY];
}
