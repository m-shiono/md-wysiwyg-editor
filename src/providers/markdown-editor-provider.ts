import * as vscode from 'vscode';
import * as path from 'path';
import { MarkdownDocument } from './markdown-document';
import { MarpPreviewManager } from '../commands/marp-preview';
import {
  convertTableToGfm,
  convertTableToHtml,
  jsonToDoc,
  serializeMarkdown,
  type TipTapDoc,
} from '../serializers/markdown-serializer';
import { getDefaultPlantUmlRenderer } from '../utils/plantuml-renderer';
import { isReadonly } from '../utils/readonly-state';
import { checkTableLimits, countTableDimensions } from '../utils/table-limits';
import {
  formatImageFilename,
  getNextImageSequence,
  isSafeImagePath,
  mimeToExtension,
} from '../utils/image-numbering';
import { logError, logInfo } from '../utils/logger';
import {
  acceptsWebviewContentUpdate,
  DEFAULT_EDITOR_MODE,
  EditorModeState,
  isEditorMode,
  resolveConfiguredEditorMode,
  type EditorMode,
} from '../utils/editor-mode';
import { buildModeSwitchMessages } from '../utils/editor-mode-sync';
import { applyDisplayUriRewrite } from '../utils/preview-projection';
import type { WebviewUriResolver } from '../utils/image-uri-rewrite';
import { buildPreviewProjectionMessages } from '../utils/preview-projection';
import type { MarpRenderOptions } from '../utils/marp-render';
import { handleCustomEditorDisposed } from '../utils/editor-switch-guard';
import { shouldAcceptWebviewUpdate } from '../utils/webview-update-epoch';
import { buildThemeUpdatedMessage, mapColorThemeKind } from '../utils/theme-sync';
import type {
  WebviewDiagnosticSnapshot,
  WebviewInboundMessage,
  WebviewOutboundMessage,
} from '../webviews/messages';
import { showNativeMarkdownPreview } from '../commands/native-markdown-preview';
import { setMarkdownEditorProvider } from '../utils/editor-provider-hook';
import {
  countDocumentStats,
  formatStatusBarText,
  formatStatusBarTooltip,
} from '../utils/document-stats';
import {
  classifyLinkHref,
  resolveRelativeLinkTarget,
} from '../utils/link-navigation';
import { updateOrInsertTableOfContents } from '../utils/editor-assist';

export class MarkdownEditorProvider implements vscode.CustomEditorProvider<MarkdownDocument> {
  static readonly viewType = 'md-wysiwyg-editor.wysiwyg';
  private static readonly EXTERNAL_CHANGE_DEBOUNCE_MS = 250;
  private static readonly SELF_SAVE_SUPPRESS_MS = 500;

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<MarkdownDocument>
  >();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  private readonly _openPanels = new Map<string, vscode.WebviewPanel>();
  private readonly _openDocuments = new Map<string, MarkdownDocument>();
  private readonly _modeStates = new Map<string, EditorModeState>();
  /** Convert bumps this; older webview `update` messages must not restore HTML. */
  private readonly _minUpdateEpoch = new Map<string, number>();
  private readonly _readyUris = new Set<string>();
  private readonly _webviewHtml = new Map<string, string>();
  private readonly _fileWatchers = new Map<string, vscode.FileSystemWatcher>();
  private readonly _reloadDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly _savingUris = new Set<string>();
  private readonly _selfSaveSuppressUntil = new Map<string, number>();
  private readonly _messageQueues = new Map<string, Promise<void>>();
  private readonly _statusBarItem: vscode.StatusBarItem;
  private _activeUriKey: string | undefined;
  private readonly _cursorStatuses = new Map<
    string,
    { mode: EditorMode; line: number; column?: number; selectedText?: string }
  >();
  private readonly _pendingDiagnostics = new Map<
    string,
    (snapshot: WebviewDiagnosticSnapshot) => void
  >();
  private _diagnosticSeq = 0;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly marpManager: MarpPreviewManager,
  ) {
    setMarkdownEditorProvider(this);
    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.context.subscriptions.push(
      this._statusBarItem,
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this._activeUriKey = undefined;
          this._statusBarItem.hide();
        }
      }),
      vscode.window.onDidChangeActiveColorTheme((theme) => {
        const message = buildThemeUpdatedMessage(mapColorThemeKind(theme.kind));
        for (const panel of this._openPanels.values()) {
          this.postMessage(panel.webview, message);
        }
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        const affectsGeneral =
          event.affectsConfiguration('md-wysiwyg-editor.defaultMode') ||
          event.affectsConfiguration('md-wysiwyg-editor');
        for (const [key, panel] of this._openPanels.entries()) {
          const document = this._openDocuments.get(key);
          if (!document) {
            continue;
          }
          if (
            affectsGeneral ||
            event.affectsConfiguration('md-wysiwyg-editor.defaultMode', document.uri) ||
            event.affectsConfiguration('md-wysiwyg-editor', document.uri)
          ) {
            this.syncDocumentModeWithConfig(document, panel);
          }
        }
      }),
      {
        dispose: () => {
          for (const key of Array.from(this._fileWatchers.keys())) {
            this.disposeFileWatcher(key);
          }
          for (const timer of this._reloadDebounceTimers.values()) {
            clearTimeout(timer);
          }
          this._reloadDebounceTimers.clear();
        },
      },
    );
  }

  public syncDocumentModeWithConfig(
    document: MarkdownDocument,
    panel: vscode.WebviewPanel,
  ): void {
    const config = vscode.workspace.getConfiguration('md-wysiwyg-editor', document.uri);
    const configuredMode = config.get<string>('defaultMode');
    const targetMode = resolveConfiguredEditorMode(configuredMode);
    const modeState = this.modeStateFor(document);
    if (modeState.mode !== targetMode) {
      const next = modeState.setMode(targetMode);
      for (const outbound of buildModeSwitchMessages(
        next,
        document.docJson,
        document.markdownText,
        this.marpRenderOptions(panel.webview),
      )) {
        this.postDisplayMessage(document, panel.webview, outbound);
      }
    }
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken,
  ): Promise<MarkdownDocument> {
    const doc = await MarkdownDocument.create(uri, openContext.backupId);
    if (!doc) {
      logError(
        `openCustomDocument fallback empty document for ${uri.toString()}`,
        new Error(`Unable to open document: ${uri.fsPath || uri.toString()}`),
      );
      return MarkdownDocument.createFallback(uri);
    }
    return doc;
  }

  async resolveCustomEditor(
    document: MarkdownDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const key = document.uri.toString();
    this._openPanels.set(key, webviewPanel);
    this._openDocuments.set(key, document);
    const modeState = this.modeStateFor(document, true);

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        ...this.getWorkspaceImgRoots(document.uri),
      ],
    };

    const readonly = isReadonly(this.context, document.uri);
    const html = this.getHtml(
      webviewPanel.webview,
      readonly,
      modeState.mode,
      document.uri,
    );
    this._webviewHtml.set(key, html);
    webviewPanel.webview.html = html;

    // Init only after webview posts `ready` — messages sent before the script
    // loads are dropped by VS Code.
    webviewPanel.webview.onDidReceiveMessage((raw: unknown) => {
      if (
        raw === null ||
        typeof raw !== 'object' ||
        typeof (raw as { type?: unknown }).type !== 'string'
      ) {
        return;
      }
      const message = raw as WebviewInboundMessage;
      void this.enqueueMessage(document, webviewPanel, message);
    });

    document.onDidChange((event) => {
      this._onDidChangeCustomDocument.fire({
        document,
        label: event.label,
        undo: event.undo,
        redo: event.redo,
      });
    });

    document.onDidContentChange(() => {
      const undoRedoCtx = document.activeUndoRedoContext;
      const mode = this.modeStateFor(document).mode;
      if (undoRedoCtx) {
        const nextEpoch = (this._minUpdateEpoch.get(key) ?? 0) + 1;
        this._minUpdateEpoch.set(key, nextEpoch);
        if (mode === 'preview') {
          this.postPreviewProjection(document, webviewPanel.webview);
        } else {
          this.postDisplayMessage(document, webviewPanel.webview, {
            type: 'docUpdated',
            docJson: document.docJson,
            markdownText: document.markdownText,
            updateEpoch: nextEpoch,
            selection: undoRedoCtx.selection,
            isUndoRedo: true,
          });
        }
      } else if (mode === 'preview') {
        this.postPreviewProjection(document, webviewPanel.webview);
      } else {
        this.postDisplayMessage(document, webviewPanel.webview, {
          type: 'docUpdated',
          docJson: document.docJson,
          markdownText: document.markdownText,
        });
      }
      // Content mutations clear Raw-fail state — keep webview banner in sync.
      if (!document.isRawParseFailed) {
        this.postMessage(webviewPanel.webview, {
          type: 'rawParseFailed',
          failed: false,
        });
      }
      void this.marpManager.updatePreview(document.uri, document.markdownText);
      if (this._activeUriKey === key) {
        this.updateStatusBar();
      }
    });

    webviewPanel.onDidChangeViewState((event) => {
      if (event.webviewPanel.active) {
        this._activeUriKey = key;
        this.syncDocumentModeWithConfig(document, webviewPanel);
        this.updateStatusBar();
      } else if (this._activeUriKey === key) {
        this._activeUriKey = undefined;
        this.updateStatusBar();
      }
    });

    webviewPanel.onDidDispose(() => {
      this.disposeFileWatcher(key);
      this._openPanels.delete(key);
      this._openDocuments.delete(key);
      this._modeStates.delete(key);
      this._minUpdateEpoch.delete(key);
      this._readyUris.delete(key);
      this._webviewHtml.delete(key);
      this._messageQueues.delete(key);
      this._cursorStatuses.delete(key);
      if (this._activeUriKey === key) {
        this._activeUriKey = undefined;
        this.updateStatusBar();
      }
      handleCustomEditorDisposed(this.context, document.uri);
    });

    this.setupFileWatcher(document);

    if (webviewPanel.active) {
      this._activeUriKey = key;
      this.updateStatusBar();
    }

    void this.marpManager.updatePreview(document.uri, document.markdownText);
  }

  private setupFileWatcher(document: MarkdownDocument): void {
    const scheme = document.uri.scheme;
    if (scheme !== 'file' && scheme !== 'vscode-remote') {
      return;
    }
    const key = document.uri.toString();
    this.disposeFileWatcher(key);

    const parentUri = vscode.Uri.joinPath(document.uri, '..');
    const fileName = path.posix.basename(document.uri.path);
    const pattern = new vscode.RelativePattern(parentUri, fileName);
    const watcher = vscode.workspace.createFileSystemWatcher(pattern, true, false, true);

    watcher.onDidChange(() => {
      if (this.isSelfSaveSuppressed(key) || document.isDirty) {
        return;
      }
      const existingTimer = this._reloadDebounceTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      const timer = setTimeout(() => {
        this._reloadDebounceTimers.delete(key);
        if (this.isSelfSaveSuppressed(key) || document.isDirty) {
          return;
        }
        void document.reloadFromDisk();
      }, MarkdownEditorProvider.EXTERNAL_CHANGE_DEBOUNCE_MS);
      this._reloadDebounceTimers.set(key, timer);
    });

    this._fileWatchers.set(key, watcher);
  }

  private disposeFileWatcher(key: string): void {
    const watcher = this._fileWatchers.get(key);
    if (watcher) {
      watcher.dispose();
      this._fileWatchers.delete(key);
    }
    const timer = this._reloadDebounceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this._reloadDebounceTimers.delete(key);
    }
    this._savingUris.delete(key);
    this._selfSaveSuppressUntil.delete(key);
  }

  private isSelfSaveSuppressed(key: string): boolean {
    if (this._savingUris.has(key)) {
      return true;
    }
    const until = this._selfSaveSuppressUntil.get(key);
    if (until === undefined) {
      return false;
    }
    if (Date.now() <= until) {
      return true;
    }
    this._selfSaveSuppressUntil.delete(key);
    return false;
  }

  async saveCustomDocument(
    document: MarkdownDocument,
    cancellation: vscode.CancellationToken,
  ): Promise<void> {
    const key = document.uri.toString();
    this._savingUris.add(key);
    try {
      await document.save(cancellation);
    } finally {
      this._savingUris.delete(key);
      this._selfSaveSuppressUntil.set(key, Date.now() + MarkdownEditorProvider.SELF_SAVE_SUPPRESS_MS);
    }
  }

  async saveCustomDocumentAs(
    document: MarkdownDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken,
  ): Promise<void> {
    const docKey = document.uri.toString();
    const destKey = destination.toString();
    this._savingUris.add(docKey);
    this._savingUris.add(destKey);
    try {
      await document.saveAs(destination, cancellation);
    } finally {
      this._savingUris.delete(docKey);
      this._savingUris.delete(destKey);
      const until = Date.now() + MarkdownEditorProvider.SELF_SAVE_SUPPRESS_MS;
      this._selfSaveSuppressUntil.set(docKey, until);
      this._selfSaveSuppressUntil.set(destKey, until);
    }
  }

  async revertCustomDocument(document: MarkdownDocument): Promise<void> {
    await document.revert();
    const panel = this._openPanels.get(document.uri.toString());
    if (panel) {
      this.postDisplayMessage(document, panel.webview, {
        type: 'docUpdated',
        docJson: document.docJson,
        markdownText: document.markdownText,
      });
    }
  }

  async backupCustomDocument(
    document: MarkdownDocument,
    context: vscode.CustomDocumentBackupContext,
    _cancellation: vscode.CancellationToken,
  ): Promise<vscode.CustomDocumentBackup> {
    await document.backup(context.destination);
    return { id: context.destination.toString(), delete: () => Promise.resolve() };
  }

  getActiveUri(): vscode.Uri | undefined {
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (activeTab?.input instanceof vscode.TabInputCustom) {
      if (activeTab.input.viewType === MarkdownEditorProvider.viewType) {
        return activeTab.input.uri;
      }
    }
    for (const [uriStr, panel] of this._openPanels) {
      if (panel.active) {
        return vscode.Uri.parse(uriStr);
      }
    }
    for (const [uriStr] of this._openPanels) {
      return vscode.Uri.parse(uriStr);
    }
    return undefined;
  }

  getEditorMode(uri: vscode.Uri): EditorMode {
    return this._modeStates.get(uri.toString())?.mode ?? DEFAULT_EDITOR_MODE;
  }

  /** Integration tests / Host commands: open Document for a custom editor tab. */
  getOpenDocument(uri: vscode.Uri): MarkdownDocument | undefined {
    return this._openDocuments.get(uri.toString());
  }

  /** Integration tests: open Document for a custom editor tab. */
  getOpenDocumentForTest(uri: vscode.Uri): MarkdownDocument | undefined {
    return this.getOpenDocument(uri);
  }

  /** Integration tests: return rendered Webview HTML for an open custom editor tab. */
  getWebviewHtmlForTest(uri: vscode.Uri): string | undefined {
    const key = uri.toString();
    return this._webviewHtml.get(key) ?? this._openPanels.get(key)?.webview.html;
  }

  /** Integration tests: request live DOM & Mermaid render diagnostics from Webview. */
  async getWebviewDiagnosticForTest(
    uri: vscode.Uri,
    timeoutMs = 8000,
  ): Promise<WebviewDiagnosticSnapshot> {
    const key = uri.toString();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const panel = this._openPanels.get(key);
      if (panel && this._readyUris.has(key)) {
        const requestId = `diag-${++this._diagnosticSeq}`;
        const remaining = Math.max(500, deadline - Date.now());
        return await new Promise<WebviewDiagnosticSnapshot>((resolve, reject) => {
          const timer = setTimeout(() => {
            this._pendingDiagnostics.delete(requestId);
            reject(new Error(`Timed out waiting for testDiagnosticResponse for ${key}`));
          }, remaining);
          this._pendingDiagnostics.set(requestId, (snapshot) => {
            clearTimeout(timer);
            resolve(snapshot);
          });
          this.postMessage(panel.webview, {
            type: 'testDiagnosticRequest',
            requestId,
          });
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for Webview ready state for ${key}`);
  }

  /** Integration tests: simulate an inbound webview postMessage. */
  async deliverWebviewMessageForTest(
    uri: vscode.Uri,
    message: WebviewInboundMessage,
  ): Promise<void> {
    const key = uri.toString();
    const panel = this._openPanels.get(key);
    const document = this._openDocuments.get(key);
    if (!panel || !document) {
      throw new Error(`No open custom editor for ${key}`);
    }
    await this.enqueueMessage(document, panel, message);
  }

  private enqueueMessage(
    document: MarkdownDocument,
    panel: vscode.WebviewPanel,
    message: WebviewInboundMessage,
  ): Promise<void> {
    const key = document.uri.toString();
    const prev = this._messageQueues.get(key) ?? Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(() => this.handleMessage(document, panel, message));
    this._messageQueues.set(key, next);
    return next;
  }

  refreshReadonly(uri: vscode.Uri, readonly: boolean): void {
    const panel = this._openPanels.get(uri.toString());
    if (panel) {
      this.postMessage(panel.webview, { type: 'readonlyChanged', readonly });
      void this.updateReadonlyBadge(panel, readonly);
    }
  }

  private async updateReadonlyBadge(
    panel: vscode.WebviewPanel,
    readonly: boolean,
  ): Promise<void> {
    const rawTitle = panel.title || 'document.md';
    const baseTitle = path.posix.basename(rawTitle).replace(/(?: \(Readonly\))+$/, '');
    panel.title = readonly ? `${baseTitle} (Readonly)` : baseTitle;
  }

  private getWorkspaceImgRoots(documentUri: vscode.Uri): vscode.Uri[] {
    if (documentUri.scheme === 'untitled') {
      return [];
    }
    return [vscode.Uri.joinPath(documentUri, '..', 'img')];
  }

  private postMessage(webview: vscode.Webview, message: WebviewOutboundMessage): void {
    void webview.postMessage(message);
  }

  /** Host → Webview `themeUpdated` on init/ready and VS Code color theme change (TC-013). */
  private postThemeUpdated(webview: vscode.Webview): void {
    this.postMessage(
      webview,
      buildThemeUpdatedMessage(mapColorThemeKind(vscode.window.activeColorTheme.kind)),
    );
  }

  private postDisplayMessage(
    document: MarkdownDocument,
    webview: vscode.Webview,
    message: WebviewOutboundMessage,
  ): void {
    this.postMessage(
      webview,
      applyDisplayUriRewrite(message, document.uri, this.webviewUriResolver(webview)),
    );
  }

  /** Webview-local URI of the bundled KaTeX fonts, for Marp math rendering. */
  private marpRenderOptions(webview: vscode.Webview): MarpRenderOptions {
    return {
      katexFontPath: webview
        .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'fonts'))
        .toString(),
    };
  }

  private webviewUriResolver(webview: vscode.Webview): WebviewUriResolver {
    return {
      asWebviewUri: (uri) =>
        webview.asWebviewUri(
          uri instanceof vscode.Uri ? uri : vscode.Uri.parse(uri.toString()),
        ),
    };
  }

  private postPreviewProjection(document: MarkdownDocument, webview: vscode.Webview): void {
    const mode = this.modeStateFor(document).mode;
    // Three-point Preview Marp: isMarpDocument → previewMarpHtml (Side Preview must not remove).
    for (const message of buildPreviewProjectionMessages(
      mode,
      document.docJson,
      document.markdownText,
      this.marpRenderOptions(webview),
    )) {
      this.postDisplayMessage(document, webview, message);
    }
  }

  private updateStatusBar(): void {
    const key = this._activeUriKey;
    if (!key) {
      this._statusBarItem.hide();
      return;
    }
    const document = this._openDocuments.get(key);
    const panel = this._openPanels.get(key);
    if (!document || !panel) {
      this._statusBarItem.hide();
      return;
    }
    const mode = this.modeStateFor(document).mode;
    const cursor = this._cursorStatuses.get(key);
    const stats = countDocumentStats(document.markdownText, cursor?.selectedText);
    stats.line = cursor?.line ?? 1;
    stats.column = cursor?.column ?? 1;
    this._statusBarItem.text = formatStatusBarText(stats, mode);
    this._statusBarItem.tooltip = formatStatusBarTooltip(stats, mode);
    this._statusBarItem.show();
  }

  private modeStateFor(document: MarkdownDocument, refreshFromConfig = false): EditorModeState {
    const key = document.uri.toString();
    let state = this._modeStates.get(key);
    if (!state || refreshFromConfig) {
      const config = vscode.workspace.getConfiguration('md-wysiwyg-editor', document.uri);
      const configuredMode = config.get<string>('defaultMode');
      const initialMode = resolveConfiguredEditorMode(configuredMode);
      if (!state) {
        state = new EditorModeState(initialMode);
        this._modeStates.set(key, state);
      } else {
        state.setMode(initialMode);
      }
    }
    return state;
  }

  private async handleMessage(
    document: MarkdownDocument,
    panel: vscode.WebviewPanel,
    message: WebviewInboundMessage,
  ): Promise<void> {
    const readonly = isReadonly(this.context, document.uri);
    const modeState = this.modeStateFor(document);

    switch (message.type) {
      case 'ready':
        this._readyUris.add(document.uri.toString());
        this.postDisplayMessage(document, panel.webview, {
          type: 'init',
          docJson: document.docJson,
          markdownText: document.markdownText,
          readonly,
          uri: document.uri.toString(),
          editorMode: modeState.mode,
        });
        this.postThemeUpdated(panel.webview);
        if (modeState.mode === 'preview') {
          this.postPreviewProjection(document, panel.webview);
        }
        break;
      case 'testDiagnosticResponse': {
        const resolver = this._pendingDiagnostics.get(message.requestId);
        if (resolver) {
          this._pendingDiagnostics.delete(message.requestId);
          resolver({
            readyReceived: true,
            hasProseMirror: Boolean(message.hasProseMirror),
            editorText: String(message.editorText ?? ''),
            mermaidSvgCount: Number(message.mermaidSvgCount ?? 0),
            mermaidErrors: Array.isArray(message.mermaidErrors) ? message.mermaidErrors : [],
            csp: String(message.csp ?? ''),
          });
        }
        break;
      }
      case 'setMode':
        // Mode switch alone: display only — no disk I/O, no dirty (AD-016).
        if (!isEditorMode(message.editorMode)) {
          return;
        }
        {
          const next = modeState.setMode(message.editorMode);
          for (const outbound of buildModeSwitchMessages(
            next,
            document.docJson,
            document.markdownText,
            this.marpRenderOptions(panel.webview),
          )) {
            this.postDisplayMessage(document, panel.webview, outbound);
          }
          if (this._activeUriKey === document.uri.toString()) {
            this.updateStatusBar();
          }
        }
        break;
      case 'cursorStatus': {
        const key = document.uri.toString();
        this._cursorStatuses.set(key, {
          mode: isEditorMode(message.mode) ? message.mode : modeState.mode,
          line: typeof message.line === 'number' && Number.isFinite(message.line) ? message.line : 1,
          column:
            typeof message.column === 'number' && Number.isFinite(message.column)
              ? message.column
              : undefined,
          selectedText: typeof message.selectedText === 'string' ? message.selectedText : '',
        });
        if (panel.active || this._activeUriKey === key) {
          this._activeUriKey = key;
          this.updateStatusBar();
        }
        break;
      }
      case 'update':
        if (
          readonly ||
          !acceptsWebviewContentUpdate(modeState.mode) ||
          typeof message.docJson !== 'string'
        ) {
          return;
        }
        if (
          !shouldAcceptWebviewUpdate(
            message.epoch,
            this._minUpdateEpoch.get(document.uri.toString()) ?? 0,
          )
        ) {
          return;
        }
        // Do not echo docJson — webview already has TipTap content (TC-067).
        document.updateFromJson(message.docJson, 'Edit', {
          syncWebview: false,
          undoGroupId: typeof message.undoGroupId === 'string' ? message.undoGroupId : undefined,
          selectionBefore: message.selectionBefore,
          selectionAfter: message.selectionAfter,
        });
        // Markdown edit clears Raw-fail banner if it was showing.
        this.postMessage(panel.webview, {
          type: 'rawParseFailed',
          failed: false,
        });
        // markdownText only — Raw surface refresh; avoid setContent echo.
        this.postMessage(panel.webview, {
          type: 'docUpdated',
          markdownText: document.markdownText,
        });
        void this.marpManager.updatePreview(document.uri, document.markdownText);
        if (this._activeUriKey === document.uri.toString()) {
          this.updateStatusBar();
        }
        break;
      case 'updateRaw':
        // Late flush after Raw→other mode must still apply; only file RO blocks.
        if (readonly || typeof message.markdown !== 'string') {
          return;
        }
        {
          const ok = document.applyRawSource(message.markdown, 'Raw edit', {
            syncWebview: false,
            undoGroupId: typeof message.undoGroupId === 'string' ? message.undoGroupId : undefined,
            selectionBefore: message.selectionBefore,
            selectionAfter: message.selectionAfter,
          });
          this.postMessage(panel.webview, {
            type: 'rawParseFailed',
            failed: document.isRawParseFailed,
            message: ok
              ? undefined
              : 'Raw Markdown parse failed. Document was not modified.',
          });
          if (ok) {
            this.postDisplayMessage(document, panel.webview, {
              type: 'docUpdated',
              docJson: document.docJson,
              markdownText: document.markdownText,
              origin: 'raw',
            });
            void this.marpManager.updatePreview(document.uri, document.markdownText);
            if (this._activeUriKey === document.uri.toString()) {
              this.updateStatusBar();
            }
          }
        }
        break;
      case 'insertToc':
        if (readonly) {
          return;
        }
        {
          const updated = updateOrInsertTableOfContents(document.markdownText);
          const ok = document.applyRawSource(updated, 'Insert TOC', {
            syncWebview: false,
            undoGroupId: typeof message.undoGroupId === 'string' ? message.undoGroupId : undefined,
            selectionBefore: message.selectionBefore,
          });
          if (ok) {
            this.postDisplayMessage(document, panel.webview, {
              type: 'docUpdated',
              docJson: document.docJson,
              markdownText: document.markdownText,
              origin: 'raw',
            });
            void this.marpManager.updatePreview(document.uri, document.markdownText);
            if (this._activeUriKey === document.uri.toString()) {
              this.updateStatusBar();
            }
          }
        }
        break;
      case 'requestUndo':
        if (readonly) {
          return;
        }
        if (!document.canUndo) {
          if (modeState.mode !== 'preview') {
            const key = document.uri.toString();
            const nextEpoch = (this._minUpdateEpoch.get(key) ?? 0) + 1;
            this._minUpdateEpoch.set(key, nextEpoch);
            this.postDisplayMessage(document, panel.webview, {
              type: 'docUpdated',
              docJson: document.docJson,
              markdownText: document.markdownText,
              updateEpoch: nextEpoch,
              isUndoRedo: true,
            });
          }
          return;
        }
        {
          const revBefore = document.historyRevision;
          try {
            await vscode.commands.executeCommand('undo');
          } catch {
            // Fallback handled below when command is unavailable or unbound
          }
          if (document.historyRevision === revBefore) {
            document.undo();
          }
        }
        break;
      case 'requestRedo':
        if (readonly || !document.canRedo) {
          return;
        }
        {
          const revBefore = document.historyRevision;
          try {
            await vscode.commands.executeCommand('redo');
          } catch {
            // Fallback handled below when command is unavailable or unbound
          }
          if (document.historyRevision === revBefore) {
            document.redo();
          }
        }
        break;
      case 'requestConvertToGfm':
        if (readonly || typeof message.tableIndex !== 'number') {
          return;
        }
        {
          const answer = await vscode.window.showWarningMessage(
            'リッチ内容（改行・リスト・チェックボックス等）はプレーンテキストに flatten されます。続行しますか？',
            { modal: true },
            '変換',
          );
          if (answer !== '変換') {
            this.postMessage(panel.webview, { type: 'convertToGfmCancelled' });
            return;
          }
          const key = document.uri.toString();
          if (typeof message.epoch === 'number') {
            this._minUpdateEpoch.set(key, message.epoch);
          }
          // Editor snapshot at click — not later document.doc (stale HTML update may have landed).
          const source =
            typeof message.docJson === 'string' ? jsonToDoc(message.docJson) : document.doc;
          document.updateDoc(
            convertTableToGfm(source, message.tableIndex),
            'Convert table to GFM',
          );
        }
        break;
      case 'tableOperation':
        if (readonly || typeof message.docJson !== 'string') {
          return;
        }
        {
          let doc: TipTapDoc;
          try {
            const parsed: unknown = JSON.parse(message.docJson);
            if (!parsed || typeof parsed !== 'object') {
              return;
            }
            doc = parsed as TipTapDoc;
          } catch (err) {
            logError('Invalid docJson in tableOperation', err);
            return;
          }
          const tableIndex = typeof message.tableIndex === 'number' ? message.tableIndex : 0;
          if (message.operation === 'convertToHtml') {
            document.updateDoc(convertTableToHtml(doc, tableIndex), 'Convert table to HTML');
          } else if (message.operation === 'convertToGfm') {
            document.updateDoc(convertTableToGfm(doc, tableIndex), 'Convert table to GFM');
          }
        }
        break;
      case 'checkTableLimits':
        if (typeof message.rows !== 'number' || typeof message.cols !== 'number') {
          return;
        }
        {
          const limits = checkTableLimits(message.rows, message.cols);
          this.postMessage(panel.webview, {
            type: 'tableLimitWarning',
            ...limits,
          });
        }
        break;
      case 'pasteImage':
        if (
          typeof message.mime !== 'string' ||
          typeof message.dataBase64 !== 'string'
        ) {
          return;
        }
        await this.handleImagePaste(document, panel, message, readonly);
        break;
      case 'mermaidError':
        if (typeof message.error === 'string') {
          logError(`Mermaid render error: ${message.error}`);
        }
        break;
      case 'renderPlantUml':
        if (typeof message.id === 'string' && typeof message.source === 'string') {
          const config = vscode.workspace.getConfiguration('md-wysiwyg-editor');
          const renderer = getDefaultPlantUmlRenderer(() => ({
            jarPath: config.get<string>('plantuml.jarPath', ''),
            command: config.get<string>('plantuml.command', ''),
          }));
          const available = await renderer.isAvailable();
          let svg = '';
          if (available) {
            try {
              svg = await renderer.renderSvg(message.source);
            } catch (err) {
              logError(`PlantUML render error: ${err}`);
            }
          }
          this.postMessage(panel.webview, {
            type: 'plantUmlRendered',
            id: message.id,
            svg,
            available,
          });
        }
        break;
      case 'setTablePipeAlignment':
        if (message.alignment === 'aligned' || message.alignment === 'compact') {
          document.setTablePipeAlignment(message.alignment);
          try {
            const config = vscode.workspace?.getConfiguration?.('md-wysiwyg-editor');
            await config?.update?.('table.pipeAlignment', message.alignment, vscode.ConfigurationTarget.Global);
          } catch {
            // Ignore in mocked or test environment
          }
        }
        break;
      case 'log':
        if (typeof message.message === 'string') {
          logInfo(message.message);
        }
        break;
      case 'openLink': {
        if (typeof message.href !== 'string') {
          return;
        }
        const classified = classifyLinkHref(message.href);
        if (classified.kind === 'external') {
          await vscode.env.openExternal(vscode.Uri.parse(classified.url));
        } else if (classified.kind === 'relative') {
          const targetUri = resolveRelativeLinkTarget(
            document.uri,
            classified.path,
            vscode.Uri.joinPath,
          );
          if (!targetUri) {
            void vscode.window.showWarningMessage(
              'Cannot resolve relative link in an unsaved document.',
            );
            return;
          }
          try {
            await vscode.workspace.fs.stat(targetUri);
            await vscode.commands.executeCommand('vscode.open', targetUri);
          } catch {
            void vscode.window.showWarningMessage(
              `Target file not found: ${classified.path}`,
            );
          }
        } else if (classified.kind === 'unsafe') {
          logError(
            `Blocked unsafe link: ${classified.reason}`,
            new Error(message.href),
          );
          void vscode.window.showWarningMessage('Blocked unsafe link.');
        }
        break;
      }
      case 'openNativePreview':
        await showNativeMarkdownPreview({
          uri: document.uri,
          isDirty: document.isDirty,
          isRawParseFailed: document.isRawParseFailed,
          save: () => document.save({ isCancellationRequested: false } as vscode.CancellationToken),
        });
        break;
      default:
        break;
    }
  }

  private async handleImagePaste(
    document: MarkdownDocument,
    panel: vscode.WebviewPanel,
    message: Extract<WebviewInboundMessage, { type: 'pasteImage' }>,
    readonly: boolean,
  ): Promise<void> {
    if (readonly) {
      return;
    }

    if (document.uri.scheme !== 'file' && document.uri.scheme !== 'vscode-remote') {
      void vscode.window.showWarningMessage('Save document first');
      return;
    }

    const ext = mimeToExtension(message.mime);
    if (!ext) {
      return;
    }

    try {
      const imgDirUri = vscode.Uri.joinPath(document.uri, '..', 'img');
      try {
        await vscode.workspace.fs.createDirectory(imgDirUri);
      } catch {
        /* may exist */
      }

      const entries = await vscode.workspace.fs.readDirectory(imgDirUri);
      const filenames = entries.map(([name]) => name);
      const seq = getNextImageSequence(filenames);
      const filename = formatImageFilename(seq, ext);
      const relativePath = `img/${filename}`;

      if (!isSafeImagePath(document.uri.toString(), relativePath)) {
        void vscode.window.showErrorMessage('Invalid image path');
        return;
      }

      const imageUri = vscode.Uri.joinPath(imgDirUri, filename);
      const data = Buffer.from(message.dataBase64, 'base64');
      await vscode.workspace.fs.writeFile(imageUri, data);

      this.postDisplayMessage(document, panel.webview, {
        type: 'imageInserted',
        relativePath,
      });
      logInfo(`Image saved: ${relativePath}`);
    } catch (error) {
      logError('Image paste failed', error);
      void vscode.window.showErrorMessage('Failed to save pasted image');
    }
  }

  private getHtml(
    webview: vscode.Webview,
    readonly: boolean,
    initialMode: EditorMode = DEFAULT_EDITOR_MODE,
    documentUri?: vscode.Uri,
  ): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'editor.js'),
    );
    const elkChunkUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'mermaid-layout-elk.js'),
    );
    const mermaidChunkUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'mermaid-chunk.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'editor.css'),
    );
    const katexStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'katex.min.css'),
    );
    const nonce = getNonce();
    const config = vscode.workspace.getConfiguration('md-wysiwyg-editor', documentUri);
    const tablePipeAlignment = config.get<string>('table.pipeAlignment', 'aligned');

    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'nonce-${nonce}'`,
      // nonce for entry; cspSource for ESM dynamic-import chunk (ELK lazy load)
      `script-src 'nonce-${nonce}' ${webview.cspSource}`,
      `img-src ${webview.cspSource} data: https: file:`,
      `font-src ${webview.cspSource}`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" nonce="${nonce}" />
  <link rel="stylesheet" href="${katexStyleUri}" nonce="${nonce}" />
  <title>MD WYSIWYG Editor</title>
</head>
<body data-readonly="${readonly}" data-mode="${initialMode}" data-csp-nonce="${nonce}" data-elk-chunk-uri="${elkChunkUri}" data-mermaid-chunk-uri="${mermaidChunkUri}" data-table-pipe-alignment="${tablePipeAlignment}">
  <div id="mode-toolbar" role="toolbar" aria-label="Editor mode">
    <span class="mode-segment-group" role="group" aria-label="Mode selection">
      <button type="button" data-mode="markdown"${initialMode === 'markdown' ? ' class="active"' : ''} title="Visual Editor (WYSIWYG)" aria-label="Visual Editor">Visual</button>
      <button type="button" data-mode="raw"${initialMode === 'raw' ? ' class="active"' : ''} title="Source Editor (Markdown)" aria-label="Source Editor">Source</button>
    </span>
    <button type="button" data-mode="preview"${initialMode === 'preview' ? ' class="active"' : ''} title="Editor Preview" aria-label="Editor Preview">Preview</button>
    <button type="button" data-action="toggle-outline" aria-pressed="false" title="Toggle Document Outline" aria-label="Toggle Document Outline">Outline</button>
    <button type="button" data-action="native-preview" title="Open Default Markdown Preview" aria-label="Open Default Markdown Preview">Default Preview</button>
  </div>
  <div id="toolbar" role="toolbar" aria-label="Formatting">
    <button type="button" data-cmd="bold" title="Bold" aria-pressed="false"><b>B</b></button>
    <button type="button" data-cmd="italic" title="Italic" aria-pressed="false"><i>I</i></button>
    <button type="button" data-cmd="strike" title="Strikethrough" aria-pressed="false"><span style="text-decoration:line-through">S</span></button>
    <button type="button" data-cmd="inlineCode" title="Inline Code" aria-pressed="false">\`</button>
    <span class="toolbar-sep" role="separator" aria-hidden="true"></span>
    <button type="button" data-cmd="heading" data-level="1" title="Heading 1" aria-pressed="false">H1</button>
    <button type="button" data-cmd="heading" data-level="2" title="Heading 2" aria-pressed="false">H2</button>
    <button type="button" data-cmd="heading" data-level="3" title="H3" aria-pressed="false">H3</button>
    <button type="button" data-cmd="heading" data-level="4" title="H4" aria-pressed="false">H4</button>
    <button type="button" data-cmd="heading" data-level="5" title="H5" aria-pressed="false">H5</button>
    <button type="button" data-cmd="heading" data-level="6" title="H6" aria-pressed="false">H6</button>
    <span class="toolbar-sep" role="separator" aria-hidden="true"></span>
    <button type="button" data-cmd="bulletList" title="Bullet List" aria-pressed="false">• List</button>
    <button type="button" data-cmd="orderedList" title="Ordered List" aria-pressed="false">1. List</button>
    <button type="button" data-cmd="taskList" title="Task List" aria-pressed="false">Task</button>
    <button type="button" data-cmd="blockquote" title="Blockquote" aria-pressed="false">Quote</button>
    <span class="toolbar-sep" role="separator" aria-hidden="true"></span>
    <button type="button" data-cmd="link" title="Link" aria-pressed="false">Link</button>
    <button type="button" data-cmd="codeBlock" title="Code Block" aria-pressed="false">Code</button>
    <button type="button" data-cmd="horizontalRule" title="Horizontal rule">―</button>
    <button type="button" data-cmd="insertToc" title="Table of Contents">TOC</button>
    <div id="table-menu" class="toolbar-dropdown">
      <button type="button" id="table-menu-btn" title="Table">Table ▼</button>
      <div id="table-menu-panel" class="toolbar-dropdown-panel hidden" role="menu" aria-label="Table operations">
        <button type="button" data-table-op="insert" role="menuitem">Insert table</button>
        <hr class="toolbar-dropdown-sep" />
        <button type="button" data-table-op="addRowBefore" role="menuitem">Add row above</button>
        <button type="button" data-table-op="addRowAfter" role="menuitem">Add row below</button>
        <button type="button" data-table-op="moveRowUp" role="menuitem">Move row up</button>
        <button type="button" data-table-op="moveRowDown" role="menuitem">Move row down</button>
        <button type="button" data-table-op="duplicateRow" role="menuitem">Duplicate row</button>
        <button type="button" data-table-op="deleteRow" role="menuitem">Delete row</button>
        <hr class="toolbar-dropdown-sep" />
        <button type="button" data-table-op="addColumnBefore" role="menuitem">Add column left</button>
        <button type="button" data-table-op="addColumnAfter" role="menuitem">Add column right</button>
        <button type="button" data-table-op="moveColumnLeft" role="menuitem">Move column left</button>
        <button type="button" data-table-op="moveColumnRight" role="menuitem">Move column right</button>
        <button type="button" data-table-op="deleteColumn" role="menuitem">Delete column</button>
        <hr class="toolbar-dropdown-sep" />
        <button type="button" data-table-op="alignLeft" role="menuitem">Align Left</button>
        <button type="button" data-table-op="alignCenter" role="menuitem">Align Center</button>
        <button type="button" data-table-op="alignRight" role="menuitem">Align Right</button>
        <hr class="toolbar-dropdown-sep" />
        <button type="button" data-table-op="deleteTable" role="menuitem">Delete table</button>
        <hr class="toolbar-dropdown-sep" />
        <button type="button" data-table-op="convertToGfm" role="menuitem">Convert to GFM pipe table</button>
        <button type="button" data-table-op="convertToHtml" role="menuitem">Convert to HTML table</button>
        <hr class="toolbar-dropdown-sep" />
        <button type="button" data-table-op="setDefaultGfm" role="menuitem">New tables default: GFM</button>
        <button type="button" data-table-op="setDefaultHtml" role="menuitem">New tables default: HTML</button>
        <hr class="toolbar-dropdown-sep" />
        <button type="button" data-table-op="formatTable" role="menuitem">Format table</button>
        <button type="button" data-table-op="setPipeAligned" role="menuitem">Table style: Aligned</button>
        <button type="button" data-table-op="setPipeCompact" role="menuitem">Table style: Compact</button>
      </div>
    </div>
  </div>
  <div id="link-input-bar" class="hidden" role="group" aria-label="Link URL">
    <input type="url" id="link-url-input" placeholder="https://example.com" spellcheck="false" aria-label="Link URL" />
  </div>
  <div id="find-widget" class="hidden" role="dialog" aria-label="Find and Replace">
    <div class="find-widget-row find-row">
      <button type="button" id="find-toggle-replace" class="find-icon-btn" title="Toggle Replace" aria-label="Toggle Replace" aria-expanded="false">
        <span class="codicon-arrow">▸</span>
      </button>
      <div class="find-input-wrapper">
        <input type="text" id="find-input" placeholder="Find" spellcheck="false" aria-label="Find" />
        <div class="find-options-group" role="group" aria-label="Find options">
          <button type="button" class="find-opt-btn" data-option="matchCase" title="Match Case" aria-pressed="false" aria-label="Match Case">Aa</button>
          <button type="button" class="find-opt-btn" data-option="matchWholeWord" title="Match Whole Word" aria-pressed="false" aria-label="Match Whole Word">\b</button>
          <button type="button" class="find-opt-btn" data-option="useRegex" title="Use Regular Expression" aria-pressed="false" aria-label="Use Regular Expression">.*</button>
        </div>
      </div>
      <span id="find-count" class="find-count-label" aria-live="polite">No results</span>
      <button type="button" class="find-icon-btn" data-action="find-prev" title="Previous Match (Shift+Enter)" aria-label="Previous Match">▲</button>
      <button type="button" class="find-icon-btn" data-action="find-next" title="Next Match (Enter)" aria-label="Next Match">▼</button>
      <button type="button" class="find-icon-btn" data-action="find-close" title="Close (Escape)" aria-label="Close">✕</button>
    </div>
    <div id="replace-row" class="find-widget-row replace-row hidden">
      <div class="find-replace-spacer"></div>
      <div class="replace-input-wrapper">
        <input type="text" id="replace-input" placeholder="Replace" spellcheck="false" aria-label="Replace" />
      </div>
      <button type="button" class="find-action-btn" data-action="replace-one" title="Replace (Enter)" aria-label="Replace">Replace</button>
      <button type="button" class="find-action-btn" data-action="replace-all" title="Replace All" aria-label="Replace All">Replace All</button>
    </div>
  </div>
  <div id="table-warning" class="hidden"></div>
  <div id="raw-parse-banner" class="hidden" role="alert"></div>
  <div id="editor-workspace">
    <aside id="outline-panel" class="hidden" role="navigation" aria-label="Document Outline">
      <div class="outline-header">
        <span class="outline-title">Outline</span>
        <button type="button" id="outline-close-btn" title="Close Outline" aria-label="Close Outline">×</button>
      </div>
      <div id="outline-list" role="list"></div>
    </aside>
    <div id="editor-main">
      <div id="preview-marp-root" class="hidden" role="document" aria-readonly="true"></div>
      <div id="editor"></div>
      <div id="raw-editor-container" class="hidden">
        <div id="raw-line-numbers" aria-hidden="true"></div>
        <div id="raw-editor-main">
          <div id="raw-search-backdrop" aria-hidden="true"></div>
          <textarea id="raw-editor" spellcheck="false" aria-label="Raw Markdown"></textarea>
        </div>
      </div>
    </div>
  </div>
  <div id="table-context-menu" class="context-menu hidden" role="menu" aria-label="Table Context Menu">
    <button type="button" data-table-op="addRowBefore" role="menuitem">Add row above</button>
    <button type="button" data-table-op="addRowAfter" role="menuitem">Add row below</button>
    <button type="button" data-table-op="moveRowUp" role="menuitem">Move row up</button>
    <button type="button" data-table-op="moveRowDown" role="menuitem">Move row down</button>
    <button type="button" data-table-op="duplicateRow" role="menuitem">Duplicate row</button>
    <button type="button" data-table-op="deleteRow" role="menuitem">Delete row</button>
    <hr class="toolbar-dropdown-sep" />
    <button type="button" data-table-op="addColumnBefore" role="menuitem">Add column left</button>
    <button type="button" data-table-op="addColumnAfter" role="menuitem">Add column right</button>
    <button type="button" data-table-op="moveColumnLeft" role="menuitem">Move column left</button>
    <button type="button" data-table-op="moveColumnRight" role="menuitem">Move column right</button>
    <button type="button" data-table-op="deleteColumn" role="menuitem">Delete column</button>
    <hr class="toolbar-dropdown-sep" />
    <button type="button" data-table-op="alignLeft" role="menuitem">Align Left</button>
    <button type="button" data-table-op="alignCenter" role="menuitem">Align Center</button>
    <button type="button" data-table-op="alignRight" role="menuitem">Align Right</button>
    <hr class="toolbar-dropdown-sep" />
    <button type="button" data-table-op="deleteTable" role="menuitem">Delete table</button>
  </div>
  <div id="image-popover" class="image-popover hidden" role="toolbar" aria-label="Image Options">
    <button type="button" data-preset="25%" title="25%">25%</button>
    <button type="button" data-preset="50%" title="50%">50%</button>
    <button type="button" data-preset="75%" title="75%">75%</button>
    <button type="button" data-preset="100%" title="100%">100%</button>
    <button type="button" data-align="left" title="Align left">Align left</button>
    <button type="button" data-align="center" title="Align center">Align center</button>
    <button type="button" data-align="right" title="Align right">Align right</button>
    <input type="text" id="image-alt-input" placeholder="Alt text" aria-label="Alt text" />
    <button type="button" data-action="zoom" title="Zoom">Zoom</button>
  </div>
  <div id="link-popover" class="link-popover hidden" role="toolbar" aria-label="Link Options">
    <span id="link-popover-url" class="link-popover-url"></span>
    <button type="button" data-link-action="open" title="Open link">Open</button>
    <button type="button" data-link-action="edit" title="Edit link">Edit</button>
    <button type="button" data-link-action="unlink" title="Remove link">Unlink</button>
  </div>
  <div id="slash-menu" class="slash-menu hidden" role="listbox" aria-label="Insert block"></div>
  <div id="image-lightbox" class="hidden" role="dialog" aria-modal="true" aria-label="Image Preview">
    <div class="lightbox-backdrop"></div>
    <div class="lightbox-content">
      <button type="button" class="lightbox-close" aria-label="Close">×</button>
      <img class="lightbox-image" src="" alt="" />
      <div class="lightbox-caption"></div>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

export function countTablesInDoc(docJson: string): number {
  const doc = JSON.parse(docJson) as TipTapDoc;
  return doc.content.filter((n) => n.type === 'table').length;
}

export { countTableDimensions, checkTableLimits, serializeMarkdown };
export { getWebviewCspContent } from '../utils/csp';
