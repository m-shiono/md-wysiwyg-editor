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
    constructor(opts?: Record<string, unknown>);
    render(markdown: string, env?: Record<string, unknown>): { html: string; css: string };
  }
}
