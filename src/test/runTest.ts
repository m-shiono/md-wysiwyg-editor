import * as path from 'path';
import { runTests } from '@vscode/test-electron';

/**
 * Cursor / VS Code Extension Host sets ELECTRON_RUN_AS_NODE=1, which makes
 * the VS Code binary behave as plain Node and reject --extensionTestsPath.
 * Clear it (and related host vars) before spawning a real VS Code process.
 */
function clearHostElectronEnv(): void {
  const keys = [
    'ELECTRON_RUN_AS_NODE',
    'ELECTRON_ENABLE_LOGGING',
    'ELECTRON_ENABLE_STACK_DUMPING',
    'VSCODE_IPC_HOOK',
    'VSCODE_PID',
    'VSCODE_CWD',
    'VSCODE_NLS_CONFIG',
    'VSCODE_ESM_ENTRYPOINT',
    'VSCODE_HANDLES_UNCAUGHT_ERRORS',
    'VSCODE_CRASH_REPORTER_PROCESS_TYPE',
    'VSCODE_CODE_CACHE_PATH',
    'VSCODE_PROCESS_TITLE',
  ];
  for (const key of keys) {
    delete process.env[key];
  }
}

async function main(): Promise<void> {
  try {
    clearHostElectronEnv();
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      // Prefer a recent Stable that runs on current macOS; 1.85.x Electron may fail to launch.
      version: '1.97.2',
      launchArgs: ['--disable-extensions'],
    });
  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

void main();
