/**
 * Minimal type shim for @marp-team/marp-core.
 *
 * v5 ships ESM-only type declarations (.d.mts), which cannot be resolved under
 * this project's CommonJS `moduleResolution`. Runtime resolution is unaffected
 * (esbuild bundles the package). Only the API used by src/utils/marp-render.ts
 * is declared here.
 */
declare module '@marp-team/marp-core' {
  export class Marp {
    constructor(opts?: {
      markdown?: { highlight?: (code: string, lang: string) => string } & Record<string, unknown>;
      [key: string]: unknown;
    });
    use(plugin: (md: unknown) => void, ...params: unknown[]): this;
    render(markdown: string, env?: Record<string, unknown>): { html: string; css: string };
  }
}

declare module '@marp-team/marp-core/plugins/katex' {
  const katexMarpCorePlugin: (opts?: {
    options?: Record<string, unknown>;
    fontPath?: string | false;
  }) => (md: unknown) => void;
  export default katexMarpCorePlugin;
}
