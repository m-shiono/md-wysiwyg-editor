import * as vscode from 'vscode';
import {
  parseMarkdown,
  serializeMarkdown,
  jsonToDoc,
  docToJson,
  isLargeFile,
  type TipTapDoc,
} from '../serializers/markdown-serializer';
import { logError, logWarn } from '../utils/logger';

export class MarkdownDocument implements vscode.CustomDocument {
  static async create(
    uri: vscode.Uri,
    backupId: string | undefined,
  ): Promise<MarkdownDocument | undefined> {
    try {
      const source = backupId ? vscode.Uri.parse(backupId) : uri;
      const data = await vscode.workspace.fs.readFile(source);
      return new MarkdownDocument(uri, data);
    } catch (error) {
      logError('Failed to read document', error);
      void vscode.window.showErrorMessage(`Failed to open ${uri.fsPath}`);
      return undefined;
    }
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

  private _editStack: Array<{ undo: () => void; redo: () => void; label: string }> = [];
  private _editIndex = -1;

  private constructor(uri: vscode.Uri, initialData: Uint8Array) {
    this._uri = uri;
    this._markdownText = Buffer.from(initialData).toString('utf8');
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
      const serialized = serializeMarkdown(this._doc);
      this._markdownText = serialized;
      await vscode.workspace.fs.writeFile(targetResource, Buffer.from(serialized, 'utf8'));
      this._isDirty = false;
    } catch (error) {
      logError('Serialize failure on save', error);
      void vscode.window.showErrorMessage('Failed to save: serialization error');
      throw error;
    }
  }

  async revert(): Promise<void> {
    const data = await vscode.workspace.fs.readFile(this._uri);
    this._markdownText = Buffer.from(data).toString('utf8');
    this._doc = parseMarkdown(this._markdownText);
    this._isRawParseFailed = false;
    this._isDirty = false;
    this._onDidContentChange.fire();
  }

  async backup(destination: vscode.Uri): Promise<void> {
    if (this._isRawParseFailed) {
      throw new Error('Cannot backup: Raw Markdown parse failed');
    }
    const serialized = serializeMarkdown(this._doc);
    this._markdownText = serialized;
    await vscode.workspace.fs.writeFile(destination, Buffer.from(serialized, 'utf8'));
  }

  /**
   * Apply Raw-mode source. On parse failure, leave Document intact and set
   * `isRawParseFailed` (blocks save until recovery).
   * @returns true when Document was updated
   */
  applyRawSource(
    markdown: string,
    label = 'Raw edit',
    options?: { syncWebview?: boolean },
  ): boolean {
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
      this.pushEdit(
        label,
        () => {
          this._doc = previousDoc;
          this._markdownText = previousText;
          this._isRawParseFailed = previousFailed;
          this._onDidContentChange.fire();
        },
        () => {
          this._doc = newDoc;
          this._markdownText = markdown;
          this._isRawParseFailed = false;
          this._onDidContentChange.fire();
        },
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
    options?: { syncWebview?: boolean },
  ): void {
    const previous = this._doc;
    this._doc = newDoc;
    this._isRawParseFailed = false;
    try {
      this._markdownText = serializeMarkdown(newDoc);
    } catch {
      // Keep in-memory doc; save will fail later
    }
    this.pushEdit(
      label,
      () => {
        this._doc = previous;
        try {
          this._markdownText = serializeMarkdown(previous);
        } catch {
          /* noop */
        }
        this._onDidContentChange.fire();
      },
      () => {
        this._doc = newDoc;
        try {
          this._markdownText = serializeMarkdown(newDoc);
        } catch {
          /* noop */
        }
        this._onDidContentChange.fire();
      },
    );
    // Webview-originated edits must not echo setContent back into the same editor.
    if (options?.syncWebview !== false) {
      this._onDidContentChange.fire();
    }
  }

  updateFromJson(
    json: string,
    label = 'Edit',
    options?: { syncWebview?: boolean },
  ): void {
    this.updateDoc(jsonToDoc(json), label, options);
  }

  private pushEdit(label: string, undo: () => void, redo: () => void): void {
    this._editStack = this._editStack.slice(0, this._editIndex + 1);
    this._editStack.push({ label, undo, redo });
    this._editIndex = this._editStack.length - 1;
    this._isDirty = true;
    this._onDidChange.fire({
      document: this,
      label,
      undo: async () => {
        this._editIndex--;
        this._editStack[this._editIndex + 1]?.undo();
      },
      redo: async () => {
        this._editIndex++;
        this._editStack[this._editIndex]?.redo();
      },
    });
  }
}
