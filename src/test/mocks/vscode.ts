/**
 * Enhanced vscode shim for unit tests (AD-003) that exercise Extension Host
 * modules outside the real Extension Development Host with real classes,
 * events, URI scheme handling (file / vscode-remote / untitled), and state.
 */
import * as path from 'path';

type Listener<T> = (e: T) => unknown;

export class Disposable {
  constructor(private readonly callOnDispose: () => unknown = () => undefined) {}

  static from(...disposables: Array<{ dispose: () => unknown }>): Disposable {
    return new Disposable(() => {
      for (const d of disposables) {
        d.dispose();
      }
    });
  }

  dispose(): void {
    this.callOnDispose();
  }
}

export class EventEmitter<T> {
  private readonly listeners: Listener<T>[] = [];

  readonly event = (listener: Listener<T>): { dispose: () => void } => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
          this.listeners.splice(index, 1);
        }
      },
    };
  };

  fire(data: T): void {
    for (const listener of [...this.listeners]) {
      listener(data);
    }
  }

  dispose(): void {
    this.listeners.length = 0;
  }
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export enum ColorThemeKind {
  Light = 1,
  Dark = 2,
  HighContrast = 3,
  HighContrastLight = 4,
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

export class Position {
  constructor(
    readonly line: number,
    readonly character: number,
  ) {}
}

export class Range {
  readonly start: Position;
  readonly end: Position;

  constructor(start: Position, end: Position);
  constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
  constructor(
    startOrLine: Position | number,
    endOrChar: Position | number,
    endLine?: number,
    endChar?: number,
  ) {
    if (typeof startOrLine === 'number') {
      this.start = new Position(startOrLine, endOrChar as number);
      this.end = new Position(endLine ?? 0, endChar ?? 0);
    } else {
      this.start = startOrLine;
      this.end = endOrChar as Position;
    }
  }

  get isEmpty(): boolean {
    return this.start.line === this.end.line && this.start.character === this.end.character;
  }
}

export class Selection extends Range {
  readonly anchor: Position;
  readonly active: Position;

  constructor(anchor: Position, active: Position);
  constructor(anchorLine: number, anchorChar: number, activeLine: number, activeChar: number);
  constructor(
    anchorOrLine: Position | number,
    activeOrChar: Position | number,
    activeLine?: number,
    activeChar?: number,
  ) {
    if (typeof anchorOrLine === 'number') {
      const a = new Position(anchorOrLine, activeOrChar as number);
      const b = new Position(activeLine ?? 0, activeChar ?? 0);
      super(a, b);
      this.anchor = a;
      this.active = b;
    } else {
      super(anchorOrLine, activeOrChar as Position);
      this.anchor = anchorOrLine;
      this.active = activeOrChar as Position;
    }
  }
}

export class CancellationTokenSource {
  private cancelled = false;
  private readonly emitter = new EventEmitter<void>();

  readonly token = {
    get isCancellationRequested(): boolean {
      return false;
    },
    onCancellationRequested: this.emitter.event,
  };

  constructor() {
    const self = this;
    this.token = {
      get isCancellationRequested(): boolean {
        return self.cancelled;
      },
      onCancellationRequested: this.emitter.event,
    };
  }

  cancel(): void {
    if (!this.cancelled) {
      this.cancelled = true;
      this.emitter.fire();
    }
  }

  dispose(): void {
    this.emitter.dispose();
  }
}

export class Uri {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;
  readonly fsPath: string;

  private constructor(
    scheme: string,
    authority: string,
    uriPath: string,
    query = '',
    fragment = '',
  ) {
    this.scheme = scheme;
    this.authority = authority;
    this.path = uriPath;
    this.query = query;
    this.fragment = fragment;
    this.fsPath = uriPath;
  }

  static file(filePath: string): Uri {
    const normalized = filePath.startsWith('/') ? filePath : `/${filePath}`;
    return new Uri('file', '', normalized);
  }

  static parse(value: string): Uri {
    if (!value) {
      return new Uri('file', '', '/');
    }
    const matchWithAuth = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/.exec(
      value,
    );
    if (matchWithAuth) {
      const [, scheme, authority, uriPath, query = '', fragment = ''] = matchWithAuth;
      return new Uri(scheme, authority, uriPath || '/', query, fragment);
    }
    const matchNoAuth = /^([a-zA-Z][a-zA-Z0-9+.-]*):([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/.exec(value);
    if (matchNoAuth) {
      const [, scheme, uriPath, query = '', fragment = ''] = matchNoAuth;
      return new Uri(scheme, '', uriPath, query, fragment);
    }
    return Uri.file(value);
  }

  static joinPath(base: Uri, ...pathSegments: string[]): Uri {
    const joined = path.posix.join(base.path || '/', ...pathSegments);
    return new Uri(base.scheme, base.authority, joined, base.query, base.fragment);
  }

  with(change: {
    scheme?: string;
    authority?: string;
    path?: string;
    query?: string;
    fragment?: string;
  }): Uri {
    return new Uri(
      change.scheme ?? this.scheme,
      change.authority ?? this.authority,
      change.path ?? this.path,
      change.query ?? this.query,
      change.fragment ?? this.fragment,
    );
  }

  toString(): string {
    const q = this.query ? `?${this.query}` : '';
    const f = this.fragment ? `#${this.fragment}` : '';
    if (this.scheme === 'untitled' && !this.authority && !this.path.startsWith('/')) {
      return `${this.scheme}:${this.path}${q}${f}`;
    }
    return `${this.scheme}://${this.authority}${this.path}${q}${f}`;
  }
}

export class TabInputText {
  constructor(readonly uri: Uri) {}
}

export class TabInputCustom {
  readonly uri: Uri;
  readonly viewType: string;

  constructor(uri: Uri, viewType: string) {
    this.uri = uri;
    this.viewType = viewType;
  }
}

/** Standard Markdown Preview and other webview editors (Pattern A exclusion). */
export class TabInputWebview {
  readonly viewType: string;

  constructor(viewType: string) {
    this.viewType = viewType;
  }
}

// --- In-memory file system & state stores ---

const fileContents = new Map<string, Uint8Array>();
const directories = new Set<string>();

function uriKey(uri: { toString(): string; fsPath: string }): string {
  return uri.toString();
}

export function setMockFile(uri: Uri | { toString(): string; fsPath: string }, content: string | Uint8Array): void {
  const key = uriKey(uri);
  const bytes = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  fileContents.set(key, bytes);
}

export function clearMockFiles(): void {
  fileContents.clear();
  directories.clear();
}

export function getMockFileContent(uri: Uri): string | undefined {
  const bytes = fileContents.get(uriKey(uri));
  return bytes ? Buffer.from(bytes).toString('utf8') : undefined;
}

// --- Configuration store ---

const configStore = new Map<string, Record<string, unknown>>();
const onDidChangeConfigurationEmitter = new EventEmitter<{
  affectsConfiguration: (section: string, scope?: Uri) => boolean;
}>();

export function setMockConfiguration(
  section: string,
  values: Record<string, unknown>,
  scopeUri?: Uri,
): void {
  const key = scopeUri ? `${section}::${scopeUri.toString()}` : section;
  configStore.set(key, { ...(configStore.get(key) ?? {}), ...values });
}

export function fireMockConfigurationChange(affectedSections: string[], scopeUri?: Uri): void {
  onDidChangeConfigurationEmitter.fire({
    affectsConfiguration: (section: string, scope?: Uri) => {
      if (scopeUri && scope && scope.toString() !== scopeUri.toString()) {
        return false;
      }
      return affectedSections.some(
        (s) => s === section || s.startsWith(`${section}.`) || section.startsWith(`${s}.`),
      );
    },
  });
}

// --- Text documents & editors ---

export interface MockTextDocument {
  uri: Uri;
  languageId: string;
  isDirty: boolean;
  getText: (range?: Range) => string;
  save: () => Promise<boolean>;
  positionAt: (offset: number) => Position;
  offsetAt: (position: Position) => number;
}

export function createMockTextDocument(
  uri: Uri,
  initialText: string,
  options?: { languageId?: string; isDirty?: boolean; onSave?: () => Promise<boolean> | boolean },
): MockTextDocument {
  let text = initialText;
  let dirty = options?.isDirty ?? false;

  const doc: MockTextDocument = {
    uri,
    languageId: options?.languageId ?? 'markdown',
    get isDirty(): boolean {
      return dirty;
    },
    set isDirty(v: boolean) {
      dirty = v;
    },
    getText(range?: Range): string {
      if (!range) {
        return text;
      }
      const startOffset = doc.offsetAt(range.start);
      const endOffset = doc.offsetAt(range.end);
      return text.slice(startOffset, endOffset);
    },
    async save(): Promise<boolean> {
      if (options?.onSave) {
        const res = await options.onSave();
        if (res) {
          dirty = false;
        }
        return res;
      }
      setMockFile(uri, text);
      dirty = false;
      return true;
    },
    positionAt(offset: number): Position {
      const clamped = Math.max(0, Math.min(offset, text.length));
      const before = text.slice(0, clamped);
      const lines = before.split('\n');
      return new Position(lines.length - 1, lines[lines.length - 1].length);
    },
    offsetAt(position: Position): number {
      const lines = text.split('\n');
      let offset = 0;
      for (let i = 0; i < Math.min(position.line, lines.length); i++) {
        offset += lines[i].length + 1;
      }
      const lineText = lines[position.line] ?? '';
      return offset + Math.min(position.character, lineText.length);
    },
  };

  // Expose internal text mutator for MockTextEditor.edit
  (doc as unknown as { __setText: (next: string) => void }).__setText = (next: string) => {
    text = next;
    dirty = true;
  };

  return doc;
}

export interface MockTextEditor {
  document: MockTextDocument;
  selection: Selection;
  edit: (
    callback: (editBuilder: {
      replace: (location: Range | Selection | Position, value: string) => void;
      insert: (location: Position, value: string) => void;
      delete: (location: Range | Selection) => void;
    }) => void,
  ) => Promise<boolean>;
}

export function createMockTextEditor(
  uri: Uri,
  initialText: string,
  selection?: Selection,
  options?: { languageId?: string; isDirty?: boolean },
): MockTextEditor {
  const document = createMockTextDocument(uri, initialText, options);
  const editor: MockTextEditor = {
    document,
    selection: selection ?? new Selection(0, 0, 0, 0),
    async edit(callback): Promise<boolean> {
      const fullText = document.getText();
      const ops: Array<{ start: number; end: number; value: string }> = [];
      callback({
        replace(location, value) {
          if (location instanceof Position) {
            const pos = document.offsetAt(location);
            ops.push({ start: pos, end: pos, value });
          } else {
            ops.push({
              start: document.offsetAt(location.start),
              end: document.offsetAt(location.end),
              value,
            });
          }
        },
        insert(location, value) {
          const pos = document.offsetAt(location);
          ops.push({ start: pos, end: pos, value });
        },
        delete(location) {
          ops.push({
            start: document.offsetAt(location.start),
            end: document.offsetAt(location.end),
            value: '',
          });
        },
      });
      ops.sort((a, b) => b.start - a.start);
      let next = fullText;
      for (const op of ops) {
        next = next.slice(0, op.start) + op.value + next.slice(op.end);
      }
      (document as unknown as { __setText: (v: string) => void }).__setText(next);
      return true;
    },
  };
  return editor;
}

// --- Webview & Panel mock ---

export interface MockWebview {
  html: string;
  options: Record<string, unknown>;
  readonly cspSource: string;
  readonly postedMessages: unknown[];
  asWebviewUri: (uri: Uri) => Uri;
  postMessage: (message: unknown) => Promise<boolean>;
  onDidReceiveMessage: EventEmitter<unknown>['event'];
  simulateReceiveMessage: (message: unknown) => void;
}

export interface MockWebviewPanel {
  readonly viewType: string;
  title: string;
  readonly viewColumn: ViewColumn;
  active: boolean;
  visible: boolean;
  readonly webview: MockWebview;
  readonly onDidDispose: EventEmitter<void>['event'];
  readonly onDidChangeViewState: EventEmitter<{ webviewPanel: MockWebviewPanel }>['event'];
  reveal: (viewColumn?: ViewColumn, preserveFocus?: boolean) => void;
  dispose: () => void;
  setActive: (active: boolean) => void;
}

export function createMockWebviewPanel(
  viewType: string,
  title: string,
  viewColumn: ViewColumn = ViewColumn.One,
  options: Record<string, unknown> = {},
): MockWebviewPanel {
  const receiveEmitter = new EventEmitter<unknown>();
  const disposeEmitter = new EventEmitter<void>();
  const viewStateEmitter = new EventEmitter<{ webviewPanel: MockWebviewPanel }>();
  const postedMessages: unknown[] = [];

  const webview: MockWebview = {
    html: '',
    options,
    cspSource: 'https://mock.vscode-resource.vscode-cdn.net',
    postedMessages,
    asWebviewUri(uri: Uri): Uri {
      return Uri.parse(
        `https://mock.vscode-resource.vscode-cdn.net/${uri.scheme}/${uri.authority}${uri.path}`,
      );
    },
    async postMessage(message: unknown): Promise<boolean> {
      postedMessages.push(message);
      return true;
    },
    onDidReceiveMessage: receiveEmitter.event,
    simulateReceiveMessage(message: unknown): void {
      receiveEmitter.fire(message);
    },
  };

  const panel: MockWebviewPanel = {
    viewType,
    title,
    viewColumn,
    active: true,
    visible: true,
    webview,
    onDidDispose: disposeEmitter.event,
    onDidChangeViewState: viewStateEmitter.event,
    reveal(): void {
      panel.active = true;
      panel.visible = true;
      viewStateEmitter.fire({ webviewPanel: panel });
    },
    dispose(): void {
      disposeEmitter.fire();
      receiveEmitter.dispose();
      disposeEmitter.dispose();
      viewStateEmitter.dispose();
    },
    setActive(active: boolean): void {
      panel.active = active;
      viewStateEmitter.fire({ webviewPanel: panel });
    },
  };

  createdPanels.push(panel);
  return panel;
}

// --- Recorded calls & interceptors ---

const createdPanels: MockWebviewPanel[] = [];
const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
const registeredCustomEditors = new Map<string, { provider: unknown; options?: unknown }>();
const executedCommandCalls: Array<{ command: string; args: unknown[] }> = [];
const recordedMessages: Array<{ level: 'info' | 'warn' | 'error'; message: string; items: unknown[] }> = [];
const recordedOutputLines: string[] = [];
const openedExternalUris: Uri[] = [];
let clipboardText = '';

let quickPickHandler:
  | ((items: unknown[], options?: unknown) => unknown | Promise<unknown>)
  | undefined;
let saveDialogHandler: ((options?: unknown) => Uri | undefined | Promise<Uri | undefined>) | undefined;
let messageHandler:
  | ((level: 'info' | 'warn' | 'error', message: string, ...items: unknown[]) => unknown | Promise<unknown>)
  | undefined;
let commandInterceptor: ((command: string, ...args: unknown[]) => unknown | Promise<unknown>) | undefined;

export function setMockQuickPickHandler(
  handler: ((items: unknown[], options?: unknown) => unknown | Promise<unknown>) | undefined,
): void {
  quickPickHandler = handler;
}

export function setMockSaveDialogHandler(
  handler: ((options?: unknown) => Uri | undefined | Promise<Uri | undefined>) | undefined,
): void {
  saveDialogHandler = handler;
}

export function setMockMessageHandler(
  handler:
    | ((level: 'info' | 'warn' | 'error', message: string, ...items: unknown[]) => unknown | Promise<unknown>)
    | undefined,
): void {
  messageHandler = handler;
}

export function setMockCommandInterceptor(
  handler: ((command: string, ...args: unknown[]) => unknown | Promise<unknown>) | undefined,
): void {
  commandInterceptor = handler;
}

export function getRecordedMessages(): typeof recordedMessages {
  return recordedMessages;
}

export function getExecutedCommands(): typeof executedCommandCalls {
  return executedCommandCalls;
}

export function getCreatedWebviewPanels(): MockWebviewPanel[] {
  return createdPanels;
}

export function getRecordedOutputLines(): string[] {
  return recordedOutputLines;
}

export function getOpenedExternalUris(): Uri[] {
  return openedExternalUris;
}

export function getRegisteredCustomEditors(): typeof registeredCustomEditors {
  return registeredCustomEditors;
}

// --- Theme & Env events ---

const onDidChangeActiveColorThemeEmitter = new EventEmitter<{ kind: ColorThemeKind }>();

export function fireMockColorThemeChange(kind: ColorThemeKind): void {
  window.activeColorTheme = { kind };
  onDidChangeActiveColorThemeEmitter.fire({ kind });
}

export function setMockAppName(name: string): void {
  env.appName = name;
}

export function setMockRemoteName(name: string | undefined): void {
  env.remoteName = name;
}

// --- Namespaces ---

const workspace = {
  name: undefined as string | undefined,
  workspaceFolders: undefined as Array<{ uri: Uri; name: string; index: number }> | undefined,
  textDocuments: [] as MockTextDocument[],
  fs: {
    readFile: async (uri: Uri): Promise<Uint8Array> => {
      const data = fileContents.get(uriKey(uri));
      if (!data) {
        throw new Error(`ENOENT: ${uri.toString()}`);
      }
      return data;
    },
    writeFile: async (uri: Uri, content: Uint8Array): Promise<void> => {
      fileContents.set(uriKey(uri), content);
    },
    createDirectory: async (uri: Uri): Promise<void> => {
      directories.add(uriKey(uri));
    },
    readDirectory: async (uri: Uri): Promise<Array<[string, FileType]>> => {
      const prefix = uriKey(uri).replace(/\/$/, '') + '/';
      const entries: Array<[string, FileType]> = [];
      const seen = new Set<string>();
      for (const key of fileContents.keys()) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          const slashIdx = rest.indexOf('/');
          const name = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
          if (name && !seen.has(name)) {
            seen.add(name);
            entries.push([name, slashIdx === -1 ? FileType.File : FileType.Directory]);
          }
        }
      }
      return entries;
    },
    delete: async (uri: Uri): Promise<void> => {
      fileContents.delete(uriKey(uri));
      directories.delete(uriKey(uri));
    },
    stat: async (uri: Uri): Promise<{ type: FileType; size: number; ctime: number; mtime: number }> => {
      const data = fileContents.get(uriKey(uri));
      if (data) {
        return { type: FileType.File, size: data.byteLength, ctime: 0, mtime: 0 };
      }
      if (directories.has(uriKey(uri))) {
        return { type: FileType.Directory, size: 0, ctime: 0, mtime: 0 };
      }
      throw new Error(`ENOENT: ${uri.toString()}`);
    },
  },
  getConfiguration: (section?: string, scope?: Uri) => {
    const scopeKey = section && scope ? `${section}::${scope.toString()}` : undefined;
    const baseKey = section ?? '';
    return {
      get: <T>(key: string, defaultValue?: T): T => {
        const scoped = scopeKey ? configStore.get(scopeKey) : undefined;
        if (scoped && key in scoped) {
          return scoped[key] as T;
        }
        const base = configStore.get(baseKey);
        if (base && key in base) {
          return base[key] as T;
        }
        return defaultValue as T;
      },
      has: (key: string): boolean => {
        const scoped = scopeKey ? configStore.get(scopeKey) : undefined;
        if (scoped && key in scoped) {
          return true;
        }
        const base = configStore.get(baseKey);
        return Boolean(base && key in base);
      },
      inspect: () => undefined,
      update: async (key: string, value: unknown): Promise<void> => {
        const current = configStore.get(baseKey) ?? {};
        current[key] = value;
        configStore.set(baseKey, current);
        fireMockConfigurationChange([section ? `${section}.${key}` : key], scope);
      },
    };
  },
  onDidChangeConfiguration: onDidChangeConfigurationEmitter.event,
  openTextDocument: async (uriOrOptions: Uri | string | { content?: string; language?: string }): Promise<MockTextDocument> => {
    if (uriOrOptions instanceof Uri) {
      const existing = workspace.textDocuments.find((d) => d.uri.toString() === uriOrOptions.toString());
      if (existing) {
        return existing;
      }
      const bytes = fileContents.get(uriKey(uriOrOptions));
      const text = bytes ? Buffer.from(bytes).toString('utf8') : '';
      const doc = createMockTextDocument(uriOrOptions, text);
      workspace.textDocuments.push(doc);
      return doc;
    }
    if (typeof uriOrOptions === 'string') {
      return workspace.openTextDocument(Uri.file(uriOrOptions));
    }
    const untitled = Uri.parse('untitled:Untitled-1.md');
    const doc = createMockTextDocument(untitled, uriOrOptions?.content ?? '', {
      languageId: uriOrOptions?.language ?? 'markdown',
    });
    workspace.textDocuments.push(doc);
    return doc;
  },
};

const window = {
  showErrorMessage: async (message: string, ...items: unknown[]): Promise<unknown> => {
    recordedMessages.push({ level: 'error', message, items });
    return messageHandler ? messageHandler('error', message, ...items) : undefined;
  },
  showInformationMessage: async (message: string, ...items: unknown[]): Promise<unknown> => {
    recordedMessages.push({ level: 'info', message, items });
    return messageHandler ? messageHandler('info', message, ...items) : undefined;
  },
  showWarningMessage: async (message: string, ...items: unknown[]): Promise<unknown> => {
    recordedMessages.push({ level: 'warn', message, items });
    return messageHandler ? messageHandler('warn', message, ...items) : undefined;
  },
  showQuickPick: async (items: unknown[], options?: unknown): Promise<unknown> => {
    return quickPickHandler ? quickPickHandler(items, options) : undefined;
  },
  showSaveDialog: async (options?: unknown): Promise<Uri | undefined> => {
    return saveDialogHandler ? saveDialogHandler(options) : undefined;
  },
  withProgress: async <R>(
    _options: unknown,
    task: (progress: { report: (value: unknown) => void }, token: CancellationTokenSource['token']) => Promise<R>,
  ): Promise<R> => {
    const cts = new CancellationTokenSource();
    return task({ report: () => undefined }, cts.token);
  },
  setStatusBarMessage: (_text: string, _hideAfterTimeout?: number): Disposable => new Disposable(),
  createOutputChannel: (name: string) => ({
    appendLine: (line: string): void => {
      recordedOutputLines.push(line);
    },
    append: (value: string): void => {
      recordedOutputLines.push(value);
    },
    clear: (): void => undefined,
    show: (): void => undefined,
    hide: (): void => undefined,
    name,
    dispose: (): void => undefined,
  }),
  createWebviewPanel: (
    viewType: string,
    title: string,
    showOptions: ViewColumn | { viewColumn: ViewColumn },
    options?: Record<string, unknown>,
  ): MockWebviewPanel => {
    const col = typeof showOptions === 'number' ? showOptions : showOptions.viewColumn;
    return createMockWebviewPanel(viewType, title, col, options);
  },
  registerCustomEditorProvider: (viewType: string, provider: unknown, options?: unknown): Disposable => {
    registeredCustomEditors.set(viewType, { provider, options });
    return new Disposable(() => {
      registeredCustomEditors.delete(viewType);
    });
  },
  activeColorTheme: { kind: ColorThemeKind.Dark },
  onDidChangeActiveColorTheme: onDidChangeActiveColorThemeEmitter.event,
  tabGroups: {
    activeTabGroup: {
      viewColumn: 1,
      activeTab: undefined as { input: unknown } | undefined,
      tabs: [] as Array<{ input: unknown }>,
    },
    all: [] as Array<{
      viewColumn: number;
      activeTab: { input: unknown } | undefined;
      tabs: Array<{ input: unknown }>;
    }>,
  },
  activeTextEditor: undefined as MockTextEditor | { document: { uri: Uri } } | undefined,
};

const commands = {
  executeCommand: async (command: string, ...args: unknown[]): Promise<unknown> => {
    executedCommandCalls.push({ command, args });
    if (commandInterceptor) {
      return commandInterceptor(command, ...args);
    }
    const handler = registeredCommands.get(command);
    if (handler) {
      return handler(...args);
    }
    return undefined;
  },
  registerCommand: (
    id: string,
    handler: (...args: unknown[]) => unknown,
  ): Disposable => {
    registeredCommands.set(id, handler);
    return new Disposable(() => {
      registeredCommands.delete(id);
    });
  },
  getCommands: async (_filterInternal?: boolean): Promise<string[]> => {
    return Array.from(registeredCommands.keys());
  },
};

const env = {
  appName: 'Visual Studio Code',
  remoteName: undefined as string | undefined,
  clipboard: {
    readText: async (): Promise<string> => clipboardText,
    writeText: async (text: string): Promise<void> => {
      clipboardText = text;
    },
  },
  openExternal: async (target: Uri): Promise<boolean> => {
    openedExternalUris.push(target);
    return true;
  },
};

export interface MockExtensionContext {
  subscriptions: Array<{ dispose: () => unknown }>;
  extensionUri: Uri;
  extensionPath: string;
  workspaceState: {
    get: <T>(key: string, defaultValue?: T) => T;
    update: (key: string, value: unknown) => Promise<void>;
    keys: () => readonly string[];
  };
  globalState: {
    get: <T>(key: string, defaultValue?: T) => T;
    update: (key: string, value: unknown) => Promise<void>;
    keys: () => readonly string[];
    setKeysForSync: (keys: readonly string[]) => void;
  };
}

export function createMockExtensionContext(
  extensionPath = process.cwd(),
): MockExtensionContext {
  const wsMap = new Map<string, unknown>();
  const globalMap = new Map<string, unknown>();
  return {
    subscriptions: [],
    extensionUri: Uri.file(extensionPath),
    extensionPath,
    workspaceState: {
      get: <T>(key: string, defaultValue?: T): T =>
        (wsMap.has(key) ? wsMap.get(key) : defaultValue) as T,
      update: async (key: string, value: unknown): Promise<void> => {
        wsMap.set(key, value);
      },
      keys: () => Array.from(wsMap.keys()),
    },
    globalState: {
      get: <T>(key: string, defaultValue?: T): T =>
        (globalMap.has(key) ? globalMap.get(key) : defaultValue) as T,
      update: async (key: string, value: unknown): Promise<void> => {
        globalMap.set(key, value);
      },
      keys: () => Array.from(globalMap.keys()),
      setKeysForSync: () => undefined,
    },
  };
}

export function resetVscodeMock(): void {
  clearMockFiles();
  configStore.clear();
  workspace.name = undefined;
  workspace.workspaceFolders = undefined;
  workspace.textDocuments = [];
  window.activeTextEditor = undefined;
  window.activeColorTheme = { kind: ColorThemeKind.Dark };
  window.tabGroups = {
    activeTabGroup: { viewColumn: 1, activeTab: undefined, tabs: [] },
    all: [],
  };
  createdPanels.length = 0;
  registeredCommands.clear();
  registeredCustomEditors.clear();
  executedCommandCalls.length = 0;
  recordedMessages.length = 0;
  recordedOutputLines.length = 0;
  openedExternalUris.length = 0;
  clipboardText = '';
  quickPickHandler = undefined;
  saveDialogHandler = undefined;
  messageHandler = undefined;
  commandInterceptor = undefined;
  env.appName = 'Visual Studio Code';
  env.remoteName = undefined;
}

export {
  workspace,
  window,
  commands,
  env,
};
