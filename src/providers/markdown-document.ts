import * as vscode from 'vscode';
import {
  parseMarkdown,
  serializeMarkdown,
  jsonToDoc,
  docToJson,
  isLargeFile,
  type TipTapDoc,
  type SerializeOptions,
} from '../serializers/markdown-serializer';
import { logError, logWarn } from '../utils/logger';
import { MAX_UNDO_HISTORY } from '../utils/undo-grouping';
import type { EditorSelectionSnapshot } from '../webviews/messages';

export interface UpdateDocOptions {
  syncWebview?: boolean;
  undoGroupId?: string;
  selectionBefore?: EditorSelectionSnapshot;
  selectionAfter?: EditorSelectionSnapshot;
}

export interface UndoRedoContext {
  selection?: EditorSelectionSnapshot;
  isUndoRedo: true;
}

interface DocumentSnapshot {
  doc: TipTapDoc;
  markdownText: string;
  isRawParseFailed: boolean;
  selection?: EditorSelectionSnapshot;
}

interface EditHistoryEntry {
  label: string;
  undoGroupId?: string;
  before: DocumentSnapshot;
  after: DocumentSnapshot;
}

export class MarkdownDocument implements vscode.CustomDocument {
  static async create(
    uri: vscode.Uri,
    backupId: string | undefined,
  ): Promise<MarkdownDocument | undefined> {
    if (uri.scheme === 'untitled' && !backupId) {
      const existing = vscode.workspace.textDocuments.find(
        (d) => d.uri.toString() === uri.toString(),
      );
      const initialText = existing ? existing.getText() : '';
      return new MarkdownDocument(uri, Buffer.from(initialText, 'utf8'));
    }
    try {
      const source = backupId ? vscode.Uri.parse(backupId) : uri;
      const data = await vscode.workspace.fs.readFile(source);
      return new MarkdownDocument(uri, data);
    } catch (error) {
      logError('Failed to read document', error);
      void vscode.window.showErrorMessage(`Failed to open ${uri.fsPath || uri.toString()}`);
      return undefined;
    }
  }

  static createFallback(uri: vscode.Uri): MarkdownDocument {
    return new MarkdownDocument(uri, new Uint8Array());
  }

  private readonly _uri: vscode.Uri;
  private _markdownText: string;
  private _doc: TipTapDoc;
  private _isRawParseFailed = false;
  /** Host-side dirty for Side Preview gate — VS Code also tracks via edit events. */
  private _isDirty = false;
  private readonly _onDidChange = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<MarkdownDocument>
  >();
  readonly onDidChange = this._onDidChange.event;

  /** Fires after any content mutation including undo/redo (for Webview sync). */
  private readonly _onDidContentChange = new vscode.EventEmitter<void>();
  readonly onDidContentChange = this._onDidContentChange.event;

  private _editStack: EditHistoryEntry[] = [];
  private _editIndex = -1;
  private _savedMarkdownText: string;
  private _savedEditIndex = -1;
  private _historyRevision = 0;
  private _activeUndoRedoContext: UndoRedoContext | undefined;

  private constructor(uri: vscode.Uri, initialData: Uint8Array) {
    this._uri = uri;
    this._markdownText = Buffer.from(initialData).toString('utf8');
    this._savedMarkdownText = this._markdownText;
    if (isLargeFile(this._markdownText)) {
      logWarn(`Large file detected (${this._uri.fsPath}): editing continues with performance warning`);
    }
    try {
      this._doc = parseMarkdown(this._markdownText);
    } catch (error) {
      logError('Parse failure on open', error);
      this._doc = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: this._markdownText }] }],
      };
    }
  }

  get uri(): vscode.Uri {
    return this._uri;
  }

  get markdownText(): string {
    return this._markdownText;
  }

  get doc(): TipTapDoc {
    return this._doc;
  }

  get docJson(): string {
    return docToJson(this._doc);
  }

  /** True while Raw source cannot be parsed — save is blocked (§1 / §8). */
  get isRawParseFailed(): boolean {
    return this._isRawParseFailed;
  }

  /** True when Document has unsaved edits (Side Preview Save/Cancel gate). */
  get isDirty(): boolean {
    return this._isDirty;
  }

  get canUndo(): boolean {
    return this._editIndex >= 0;
  }

  get canRedo(): boolean {
    return this._editIndex + 1 < this._editStack.length;
  }

  get undoDepth(): number {
    return this._editIndex + 1;
  }

  get redoDepth(): number {
    return Math.max(0, this._editStack.length - 1 - this._editIndex);
  }

  get historyRevision(): number {
    return this._historyRevision;
  }

  get activeUndoRedoContext(): UndoRedoContext | undefined {
    return this._activeUndoRedoContext;
  }

  dispose(): void {
    this._onDidChange.dispose();
    this._onDidContentChange.dispose();
  }

  async save(cancellation: vscode.CancellationToken): Promise<void> {
    await this.saveAs(this._uri, cancellation);
  }

  async saveAs(
    targetResource: vscode.Uri,
    cancellation: vscode.CancellationToken,
  ): Promise<void> {
    if (cancellation.isCancellationRequested) {
      return;
    }
    if (this._isRawParseFailed) {
      const message = 'Cannot save: Raw Markdown parse failed. Fix the source and try again.';
      logError(message);
      void vscode.window.showErrorMessage(message);
      throw new Error(message);
    }
    try {
      const serialized = serializeMarkdown(this._doc, this.getSerializeOptions());
      this._markdownText = serialized;
      await vscode.workspace.fs.writeFile(targetResource, Buffer.from(serialized, 'utf8'));
      this._isDirty = false;
      this._savedMarkdownText = serialized;
      this._savedEditIndex = this._editIndex;
    } catch (error) {
      logError('Serialize failure on save', error);
      void vscode.window.showErrorMessage('Failed to save: serialization error');
      throw error;
    }
  }

  async reloadFromDisk(): Promise<boolean> {
    if (this._isDirty) {
      return false;
    }
    let data: Uint8Array;
    try {
      data = await vscode.workspace.fs.readFile(this._uri);
    } catch (error) {
      logError('Failed to reload document from disk', error);
      return false;
    }
    if (this._isDirty) {
      return false;
    }
    const diskText = Buffer.from(data).toString('utf8');
    if (diskText === this._markdownText && !this._isRawParseFailed) {
      return false;
    }
    let newDoc: TipTapDoc;
    try {
      newDoc = parseMarkdown(diskText);
    } catch (error) {
      logError('Failed to parse reloaded document from disk', error);
      return false;
    }
    if (this._isDirty) {
      return false;
    }
    this._markdownText = diskText;
    this._doc = newDoc;
    this._isRawParseFailed = false;
    this._isDirty = false;
    this._editStack = [];
    this._editIndex = -1;
    this._savedMarkdownText = diskText;
    this._savedEditIndex = -1;
    this._onDidContentChange.fire();
    return true;
  }

  async revert(): Promise<void> {
    const data = await vscode.workspace.fs.readFile(this._uri);
    this._markdownText = Buffer.from(data).toString('utf8');
    this._doc = parseMarkdown(this._markdownText);
    this._isRawParseFailed = false;
    this._isDirty = false;
    this._editStack = [];
    this._editIndex = -1;
    this._savedMarkdownText = this._markdownText;
    this._savedEditIndex = -1;
    this._onDidContentChange.fire();
  }

  async backup(destination: vscode.Uri): Promise<void> {
    if (this._isRawParseFailed) {
      throw new Error('Cannot backup: Raw Markdown parse failed');
    }
    const serialized = serializeMarkdown(this._doc, this.getSerializeOptions());
    this._markdownText = serialized;
    await vscode.workspace.fs.writeFile(destination, Buffer.from(serialized, 'utf8'));
  }

  private _tablePipeAlignmentOverride?: 'aligned' | 'compact';

  setTablePipeAlignment(alignment: 'aligned' | 'compact'): void {
    this._tablePipeAlignmentOverride = alignment;
  }

  private getSerializeOptions(): SerializeOptions {
    if (this._tablePipeAlignmentOverride) {
      return {
        deterministic: true,
        tablePipeAlignment: this._tablePipeAlignmentOverride,
      };
    }
    try {
      const config = vscode.workspace?.getConfiguration?.('md-wysiwyg-editor');
      const alignment = config?.get<string>('table.pipeAlignment', 'aligned');
      return {
        deterministic: true,
        tablePipeAlignment: alignment === 'compact' ? 'compact' : 'aligned',
      };
    } catch {
      return {
        deterministic: true,
        tablePipeAlignment: 'aligned',
      };
    }
  }

  /**
   * Apply Raw-mode source. On parse failure, leave Document intact and set
   * `isRawParseFailed` (blocks save until recovery).
   * @returns true when Document was updated
   */
  applyRawSource(
    markdown: string,
    label = 'Raw edit',
    options?: UpdateDocOptions,
  ): boolean {
    if (markdown === this._markdownText && !this._isRawParseFailed) {
      return true;
    }
    try {
      const newDoc = parseMarkdown(markdown);
      // Ensure the model is serializable before committing.
      serializeMarkdown(newDoc);
      const previousDoc = this._doc;
      const previousText = this._markdownText;
      const previousFailed = this._isRawParseFailed;
      this._doc = newDoc;
      this._markdownText = markdown;
      this._isRawParseFailed = false;
      this.commitHistoryEdit(
        label,
        {
          doc: previousDoc,
          markdownText: previousText,
          isRawParseFailed: previousFailed,
          selection: options?.selectionBefore,
        },
        {
          doc: newDoc,
          markdownText: markdown,
          isRawParseFailed: false,
          selection: options?.selectionAfter,
        },
        options,
      );
      if (options?.syncWebview !== false) {
        this._onDidContentChange.fire();
      }
      return true;
    } catch (error) {
      this._isRawParseFailed = true;
      logError('Raw parse failure — Document left intact', error);
      void vscode.window.showErrorMessage(
        'Raw Markdown parse failed. Document was not modified. Fix the source to enable save.',
      );
      return false;
    }
  }

  /**
   * @param options.syncWebview - When false, skip immediate webview echo
   *   (webview already applied the edit). Undo/redo still notify the webview.
   */
  updateDoc(
    newDoc: TipTapDoc,
    label = 'Edit',
    options?: UpdateDocOptions,
  ): void {
    const previous = this._doc;
    const previousText = this._markdownText;
    const previousFailed = this._isRawParseFailed;
    this._doc = newDoc;
    this._isRawParseFailed = false;
    const opts = this.getSerializeOptions();
    let prevSerialized = this._markdownText;
    try {
      prevSerialized = serializeMarkdown(previous, opts);
    } catch {
      // Fallback to _markdownText if previous serialization fails
    }

    let serialized = prevSerialized;
    try {
      serialized = serializeMarkdown(newDoc, opts);
    } catch {
      // Keep in-memory doc; save will fail later
    }

    if (serialized === prevSerialized) {
      // No substantive Markdown diff (e.g. TipTap roundtrip / format variant normalization).
      // Keep updated in-memory doc model, but avoid marking document dirty or pushing undo item.
      if (options?.syncWebview !== false) {
        this._onDidContentChange.fire();
      }
      return;
    }

    this._markdownText = serialized;
    this.commitHistoryEdit(
      label,
      {
        doc: previous,
        markdownText: previousText,
        isRawParseFailed: previousFailed,
        selection: options?.selectionBefore,
      },
      {
        doc: newDoc,
        markdownText: serialized,
        isRawParseFailed: false,
        selection: options?.selectionAfter,
      },
      options,
    );
    // Webview-originated edits must not echo setContent back into the same editor.
    if (options?.syncWebview !== false) {
      this._onDidContentChange.fire();
    }
  }

  updateFromJson(
    json: string,
    label = 'Edit',
    options?: UpdateDocOptions,
  ): void {
    this.updateDoc(jsonToDoc(json), label, options);
  }

  undo(): boolean {
    if (this._editIndex < 0) {
      return false;
    }
    const entry = this._editStack[this._editIndex];
    if (!entry) {
      return false;
    }
    this._editIndex -= 1;
    this._historyRevision += 1;
    this._doc = entry.before.doc;
    this._markdownText = entry.before.markdownText;
    this._isRawParseFailed = entry.before.isRawParseFailed;
    this._isDirty = !(
      this._editIndex === this._savedEditIndex &&
      this._markdownText === this._savedMarkdownText &&
      !this._isRawParseFailed
    );
    this._activeUndoRedoContext = {
      selection: entry.before.selection,
      isUndoRedo: true,
    };
    try {
      this._onDidContentChange.fire();
    } finally {
      this._activeUndoRedoContext = undefined;
    }
    return true;
  }

  redo(): boolean {
    if (this._editIndex + 1 >= this._editStack.length) {
      return false;
    }
    this._editIndex += 1;
    const entry = this._editStack[this._editIndex];
    if (!entry) {
      this._editIndex -= 1;
      return false;
    }
    this._historyRevision += 1;
    this._doc = entry.after.doc;
    this._markdownText = entry.after.markdownText;
    this._isRawParseFailed = entry.after.isRawParseFailed;
    this._isDirty = !(
      this._editIndex === this._savedEditIndex &&
      this._markdownText === this._savedMarkdownText &&
      !this._isRawParseFailed
    );
    this._activeUndoRedoContext = {
      selection: entry.after.selection,
      isUndoRedo: true,
    };
    try {
      this._onDidContentChange.fire();
    } finally {
      this._activeUndoRedoContext = undefined;
    }
    return true;
  }

  private commitHistoryEdit(
    label: string,
    before: DocumentSnapshot,
    after: DocumentSnapshot,
    options?: UpdateDocOptions,
  ): void {
    const groupId = options?.undoGroupId;
    if (
      groupId &&
      this._editIndex >= 0 &&
      this._editIndex === this._editStack.length - 1 &&
      this._editIndex !== this._savedEditIndex &&
      this._editStack[this._editIndex]?.undoGroupId === groupId
    ) {
      this._editStack[this._editIndex].after = after;
      this._isDirty = true;
      return;
    }

    if (this._savedEditIndex > this._editIndex) {
      this._savedEditIndex = -2;
    }
    this._editStack = this._editStack.slice(0, this._editIndex + 1);
    this._editStack.push({ label, undoGroupId: groupId, before, after });
    while (this._editStack.length > MAX_UNDO_HISTORY) {
      this._editStack.shift();
      if (this._savedEditIndex >= 0) {
        this._savedEditIndex -= 1;
        if (this._savedEditIndex < 0) {
          this._savedEditIndex = -2;
        }
      } else if (this._savedEditIndex === -1) {
        this._savedEditIndex = -2;
      }
    }
    this._editIndex = this._editStack.length - 1;
    this._isDirty = true;
    this._onDidChange.fire({
      document: this,
      label,
      undo: async () => {
        this.undo();
      },
      redo: async () => {
        this.redo();
      },
    });
  }
}
