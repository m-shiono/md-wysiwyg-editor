/**
 * Minimal vscode shim for unit tests that exercise Extension Host modules
 * outside the real Extension Development Host.
 */

type Listener<T> = (e: T) => unknown;

class EventEmitter<T> {
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

class Uri {
  readonly scheme: string;
  readonly path: string;
  readonly fsPath: string;

  private constructor(scheme: string, path: string) {
    this.scheme = scheme;
    this.path = path;
    this.fsPath = path;
  }

  static file(path: string): Uri {
    return new Uri('file', path);
  }

  static parse(value: string): Uri {
    if (value.startsWith('file:')) {
      return new Uri('file', value.replace(/^file:\/\//, ''));
    }
    return new Uri('file', value);
  }

  toString(): string {
    return `${this.scheme}://${this.path}`;
  }
}

const fileContents = new Map<string, Uint8Array>();

export function setMockFile(uri: Uri, content: string): void {
  fileContents.set(uri.fsPath, Buffer.from(content, 'utf8'));
}

export function clearMockFiles(): void {
  fileContents.clear();
}

const workspace = {
  fs: {
    readFile: async (uri: Uri): Promise<Uint8Array> => {
      const data = fileContents.get(uri.fsPath);
      if (!data) {
        throw new Error(`ENOENT: ${uri.fsPath}`);
      }
      return data;
    },
    writeFile: async (uri: Uri, content: Uint8Array): Promise<void> => {
      fileContents.set(uri.fsPath, content);
    },
  },
};

class TabInputText {
  constructor(readonly uri: Uri) {}
}

class TabInputCustom {
  readonly uri: Uri;
  readonly viewType: string;

  constructor(uri: Uri, viewType: string) {
    this.uri = uri;
    this.viewType = viewType;
  }
}

const window = {
  showErrorMessage: async (_message: string): Promise<undefined> => undefined,
  showInformationMessage: async (_message: string): Promise<undefined> => undefined,
  showWarningMessage: async (_message: string): Promise<undefined> => undefined,
  createOutputChannel: (_name: string) => ({
    appendLine: (_line: string): void => undefined,
    name: _name,
    dispose: (): void => undefined,
  }),
  tabGroups: {
    activeTabGroup: {
      activeTab: undefined as { input: unknown } | undefined,
    },
  },
  activeTextEditor: undefined as { document: { uri: Uri } } | undefined,
};

const commands = {
  executeCommand: async (_command: string, ..._args: unknown[]): Promise<undefined> => undefined,
  registerCommand: (
    _id: string,
    _handler: (...args: unknown[]) => unknown,
  ): { dispose: () => void } => ({
    dispose: (): void => undefined,
  }),
  getCommands: async (_filterInternal?: boolean): Promise<string[]> => [],
};

export { EventEmitter, Uri, TabInputText, TabInputCustom, workspace, window, commands };
