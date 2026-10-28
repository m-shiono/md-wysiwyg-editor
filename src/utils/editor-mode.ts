export type EditorMode = 'preview' | 'markdown' | 'raw';

export type ConfiguredEditorMode = 'source' | 'visual' | 'preview';

export const DEFAULT_EDITOR_MODE: EditorMode = 'markdown';

const VALID_MODES: ReadonlySet<EditorMode> = new Set(['preview', 'markdown', 'raw']);

export function isEditorMode(value: unknown): value is EditorMode {
  return typeof value === 'string' && VALID_MODES.has(value as EditorMode);
}

/**
 * Resolves the EditorMode from configuration setting (source | visual | preview).
 * Defaults to 'markdown' (visual) for undefined, empty, or unknown values.
 */
export function resolveConfiguredEditorMode(setting?: unknown): EditorMode {
  if (typeof setting !== 'string') {
    return DEFAULT_EDITOR_MODE;
  }
  switch (setting.trim().toLowerCase()) {
    case 'source':
      return 'raw';
    case 'visual':
      return 'markdown';
    case 'preview':
      return 'preview';
    default:
      return DEFAULT_EDITOR_MODE;
  }
}

/** Preview is RO render; Markdown/Raw accept edits when file is not RO. */
export function canEditContent(mode: EditorMode, fileReadonly: boolean): boolean {
  if (fileReadonly) {
    return false;
  }
  return mode === 'markdown' || mode === 'raw';
}

/** True when the visual TipTap surface must reject user edits (Preview or file RO). */
export function isVisualSurfaceReadOnly(mode: EditorMode, fileReadonly: boolean): boolean {
  return fileReadonly || mode === 'preview';
}

/**
 * Preview must not push content mutations to Document (one-way Document → view).
 * Markdown / Raw may send update / updateRaw.
 */
export function acceptsWebviewContentUpdate(mode: EditorMode): boolean {
  return mode === 'markdown' || mode === 'raw';
}

/** File RO still allows mode switch and viewing (Preview / Marp). */
export function canSwitchMode(_fileReadonly: boolean): boolean {
  return true;
}

/** Per-editor mode state — mode switch alone never touches disk or dirty. */
export class EditorModeState {
  private _mode: EditorMode;

  constructor(initialMode: EditorMode = DEFAULT_EDITOR_MODE) {
    this._mode = isEditorMode(initialMode) ? initialMode : DEFAULT_EDITOR_MODE;
  }

  get mode(): EditorMode {
    return this._mode;
  }

  setMode(mode: EditorMode): EditorMode {
    if (!isEditorMode(mode)) {
      return this._mode;
    }
    this._mode = mode;
    return this._mode;
  }
}
