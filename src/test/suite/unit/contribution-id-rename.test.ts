/**
 * TC-153–156: contribution / Extension ID rename to md-wysiwyg-editor.*
 * (rename-md-wysiwyg — package.json / src use md-wysiwyg-editor.*)
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const EXTENSION_NAME = 'md-wysiwyg-editor';
const EXTENSION_PUBLISHER = 'mshiono';
const EXTENSION_ID = `${EXTENSION_PUBLISHER}.${EXTENSION_NAME}`;
const REPOSITORY_URL = 'https://github.com/m-shiono/md-wysiwyg-editor.git';
const VIEW_TYPE = 'md-wysiwyg-editor.wysiwyg';
const SETTINGS_KEY = 'md-wysiwyg-editor.autoRestoreOnBuiltinSwitch';
const LEGACY_SETTINGS_KEY = 'vsc-md-editor.autoRestoreOnBuiltinSwitch';
const LEGACY_PREFIX = 'vsc-md-editor.';
const LEGACY_EXTENSION_ID = 'mshiono.vsc-md-editor';

const REQUIRED_COMMANDS = [
  'md-wysiwyg-editor.openWithWysiwyg',
  'md-wysiwyg-editor.reloadExtension',
  'md-wysiwyg-editor.showNativeMarkdownPreview',
  'md-wysiwyg-editor.showMarpPreview',
  'md-wysiwyg-editor.toggleReadonly',
] as const;

type PackageJson = {
  name: string;
  publisher: string;
  repository?: { type?: string; url?: string };
  activationEvents?: string[];
  contributes: {
    customEditors: Array<{ viewType: string }>;
    commands: Array<{ command: string }>;
    configuration?: { properties?: Record<string, { type?: string; default?: unknown }> };
    menus?: Record<string, Array<{ command?: string; when?: string }>>;
  };
};

function packageJsonPath(): string {
  return path.resolve(process.cwd(), 'package.json');
}

function loadPackageJson(): PackageJson {
  return JSON.parse(fs.readFileSync(packageJsonPath(), 'utf8')) as PackageJson;
}

function collectContributionStrings(pkg: PackageJson): string[] {
  const values: string[] = [];
  for (const editor of pkg.contributes.customEditors ?? []) {
    values.push(editor.viewType);
  }
  for (const command of pkg.contributes.commands ?? []) {
    values.push(command.command);
  }
  for (const event of pkg.activationEvents ?? []) {
    values.push(event);
  }
  for (const key of Object.keys(pkg.contributes.configuration?.properties ?? {})) {
    values.push(key);
  }
  for (const menuItems of Object.values(pkg.contributes.menus ?? {})) {
    for (const item of menuItems) {
      if (item.command) {
        values.push(item.command);
      }
      if (item.when) {
        values.push(item.when);
      }
    }
  }
  return values;
}

suite('Contribution ID rename (md-wysiwyg-editor)', () => {
  test('TC-153: package.json name/publisher/repository match Extension ID md-wysiwyg-editor', () => {
    const pkg = loadPackageJson();
    assert.strictEqual(pkg.name, EXTENSION_NAME);
    assert.strictEqual(pkg.publisher, EXTENSION_PUBLISHER);
    assert.strictEqual(
      `${pkg.publisher}.${pkg.name}`,
      EXTENSION_ID,
      'Extension ID must be mshiono.md-wysiwyg-editor',
    );
    assert.ok(pkg.repository?.url, 'repository.url required');
    assert.ok(
      pkg.repository!.url === REPOSITORY_URL ||
        pkg.repository!.url === REPOSITORY_URL.replace(/\.git$/, ''),
      `repository.url must be ${REPOSITORY_URL} (or equivalent without .git)`,
    );
  });

  test('TC-154: contributes use md-wysiwyg-editor.* viewType, commands, activation, menus', () => {
    const pkg = loadPackageJson();
    const viewTypes = pkg.contributes.customEditors.map((editor) => editor.viewType);
    assert.ok(viewTypes.includes(VIEW_TYPE), `customEditors must include ${VIEW_TYPE}`);

    const commands = pkg.contributes.commands.map((c) => c.command);
    for (const commandId of REQUIRED_COMMANDS) {
      assert.ok(commands.includes(commandId), `commands must include ${commandId}`);
    }

    const activation = pkg.activationEvents ?? [];
    assert.ok(
      activation.includes(`onCustomEditor:${VIEW_TYPE}`),
      `activationEvents must include onCustomEditor:${VIEW_TYPE}`,
    );
    assert.ok(
      activation.some((event) => event.startsWith('onCommand:md-wysiwyg-editor.')),
      'activationEvents must include onCommand:md-wysiwyg-editor.*',
    );

    const titleMenu = pkg.contributes.menus?.['editor/title'] ?? [];
    const openMenu = titleMenu.find((m) => m.command === 'md-wysiwyg-editor.openWithWysiwyg');
    assert.ok(openMenu, 'editor/title must include openWithWysiwyg');
    assert.ok(
      openMenu!.when?.includes(`activeCustomEditorId != ${VIEW_TYPE}`),
      `when clause must reference ${VIEW_TYPE}`,
    );
  });

  test('TC-155: settings key md-wysiwyg-editor.autoRestoreOnBuiltinSwitch exists without legacy key', () => {
    const pkg = loadPackageJson();
    const properties = pkg.contributes.configuration?.properties ?? {};
    const setting = properties[SETTINGS_KEY];
    assert.ok(setting, `configuration must define ${SETTINGS_KEY}`);
    assert.strictEqual(setting.type, 'boolean');
    assert.strictEqual(setting.default, false);
    assert.strictEqual(
      properties[LEGACY_SETTINGS_KEY],
      undefined,
      `legacy key ${LEGACY_SETTINGS_KEY} must be absent`,
    );
  });

  test('TC-156: package.json contributes have no vsc-md-editor. or mshiono.vsc-md-editor', () => {
    const raw = fs.readFileSync(packageJsonPath(), 'utf8');
    const pkg = loadPackageJson();
    const contributionStrings = collectContributionStrings(pkg);

    const legacyHits = contributionStrings.filter(
      (value) => value.includes(LEGACY_PREFIX) || value.includes(LEGACY_EXTENSION_ID),
    );
    assert.deepStrictEqual(
      legacyHits,
      [],
      `legacy contribution IDs must be absent; found: ${legacyHits.join(', ')}`,
    );
    assert.ok(
      !raw.includes(LEGACY_EXTENSION_ID),
      `package.json must not contain Extension ID ${LEGACY_EXTENSION_ID}`,
    );
    // name/display strings may mention product history; contributes scan above is authoritative.
    // Still require no contribution-style "vsc-md-editor." prefix anywhere in package.json text.
    assert.ok(
      !raw.includes(LEGACY_PREFIX),
      `package.json must not contain contribution prefix ${LEGACY_PREFIX}`,
    );
  });
});
