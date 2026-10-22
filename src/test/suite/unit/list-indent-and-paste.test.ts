import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  ListKeymap,
  getActiveListItemType,
  customSinkListItem,
  customLiftListItem,
  shouldDelegateToTextPaste,
} from "../../../utils/list-keymap";

// @ts-expect-error jsdom lacks standard TS typings in this config
import { JSDOM } from "jsdom";

function readRepoFile(...parts: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), ...parts), "utf8");
}

suite("List Indent/Outdent & Paste Enhancements", () => {
  let dom: InstanceType<typeof JSDOM>;
  let originalWindow: unknown;
  let originalDocument: unknown;
  let originalNavigator: unknown;

  suiteSetup(() => {
    dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"editor\"></div></body></html>", {
      url: "http://localhost/",
    });
    originalWindow = (globalThis as Record<string, unknown>).window;
    originalDocument = (globalThis as Record<string, unknown>).document;
    originalNavigator = (globalThis as Record<string, unknown>).navigator;

    Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true, writable: true });
    Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true, writable: true });
    try {
      Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
    } catch {
      // ignore if navigator cannot be overridden
    }
  });

  suiteTeardown(() => {
    try {
      Object.defineProperty(globalThis, "window", { value: originalWindow, configurable: true, writable: true });
      Object.defineProperty(globalThis, "document", { value: originalDocument, configurable: true, writable: true });
      Object.defineProperty(globalThis, "navigator", { value: originalNavigator, configurable: true, writable: true });
    } catch {
      // ignore teardown error
    }
  });

  suite("TC-PASTE: Paste handler text protection", () => {
    const editorTsSrc = readRepoFile("media/editor.ts");

    test("TC-PASTE-001: shouldDelegateToTextPaste returns true when text/plain is present", () => {
      const mockClipboard = {
        getData: (format: string) => (format === "text/plain" ? "Hello World" : ""),
      };
      assert.strictEqual(
        shouldDelegateToTextPaste(mockClipboard),
        true,
        "Should delegate to standard paste when text/plain is present",
      );
    });

    test("TC-PASTE-002: shouldDelegateToTextPaste returns true when text/html is present", () => {
      const mockClipboard = {
        getData: (format: string) => (format === "text/html" ? "<p>Rich Text</p>" : ""),
      };
      assert.strictEqual(
        shouldDelegateToTextPaste(mockClipboard),
        true,
        "Should delegate to standard paste when text/html is present",
      );
    });

    test("TC-PASTE-003: shouldDelegateToTextPaste returns false when only images are present", () => {
      const mockClipboard = {
        getData: () => "",
      };
      assert.strictEqual(
        shouldDelegateToTextPaste(mockClipboard),
        false,
        "Should not delegate when neither text/plain nor text/html is present",
      );
    });

    test("TC-PASTE-004: editor.ts uses shouldDelegateToTextPaste in attachPasteHandler", () => {
      assert.ok(
        editorTsSrc.includes("shouldDelegateToTextPaste(clipboardData)"),
        "attachPasteHandler must invoke shouldDelegateToTextPaste",
      );
    });

    test("TC-PASTE-005: editor.ts checks getAsFile before calling preventDefault", () => {
      const pasteBlockMatch = editorTsSrc.match(/for\s*\(const item of items\)[\s\S]*?return;\s*\}\s*\}\s*\}\);/);
      assert.ok(pasteBlockMatch, "paste loop must be found");
      const loopContent = pasteBlockMatch[0];
      const getFileIndex = loopContent.indexOf("item.getAsFile()");
      const preventDefaultIndex = loopContent.indexOf("event.preventDefault()");
      assert.ok(getFileIndex !== -1, "getAsFile must be called");
      assert.ok(preventDefaultIndex !== -1, "preventDefault must be called");
      assert.ok(
        getFileIndex < preventDefaultIndex,
        "item.getAsFile() check must occur before event.preventDefault()",
      );
    });
  });

  suite("TC-LIST: List Indentation & Outdent (Tab / Shift-Tab)", () => {
    let editor: Editor;

    setup(() => {
      const container = dom.window.document.getElementById("editor");
      if (container) {
        container.innerHTML = "";
      }
      editor = new Editor({
        element: container!,
        extensions: [
          StarterKit,
          Table.configure({ resizable: true }),
          TableRow,
          TableCell,
          TableHeader,
          TaskList,
          TaskItem.configure({ nested: true }),
          ListKeymap,
        ],
        content: `
          <ul>
            <li><p>Item 1</p></li>
            <li><p>Item 2</p></li>
            <li><p>Item 3</p></li>
          </ul>
        `,
      });
    });

    teardown(() => {
      editor.destroy();
    });

    test("TC-LIST-001: getActiveListItemType detects listItem inside bulletList", () => {
      editor.commands.setTextSelection(4); // inside Item 1
      const itemType = getActiveListItemType(editor.state);
      assert.ok(itemType, "Must detect list item inside ul > li");
      assert.strictEqual(itemType?.name, "listItem");
    });

    test("TC-LIST-002: getActiveListItemType returns null inside tables to preserve cell navigation", () => {
      editor.commands.setContent(`
        <table>
          <tr>
            <td><p>Cell 1</p></td>
            <td><p>Cell 2</p></td>
          </tr>
        </table>
      `);
      editor.commands.setTextSelection(4);
      const itemType = getActiveListItemType(editor.state);
      assert.strictEqual(itemType, null, "Must return null inside table cell");
    });

    test("TC-LIST-003: Tab on second item sinks it into first item's sublist", () => {
      editor.commands.setTextSelection(14); // inside Item 2
      const handled = customSinkListItem(editor.state.schema.nodes.listItem)(
        editor.state,
        editor.view.dispatch,
      );
      assert.strictEqual(handled, true, "Sink command must return true");

      const json = editor.getJSON() as { content?: Array<{ content?: Array<{ type?: string; content?: Array<{ type?: string }> }> }> };
      const firstLi = json.content?.[0]?.content?.[0];
      assert.strictEqual(firstLi?.type, "listItem");
      const nestedList = firstLi?.content?.find((n) => n.type === "bulletList");
      assert.ok(nestedList, "Item 1 must now contain a nested bulletList containing Item 2");
    });

    test("TC-LIST-004: Tab on first item alone does not crash and consumes event to prevent focus loss", () => {
      editor.commands.setTextSelection(4); // inside Item 1 (first item)
      const handled = customSinkListItem(editor.state.schema.nodes.listItem)(
        editor.state,
        editor.view.dispatch,
      );
      assert.strictEqual(handled, true, "Must consume event (return true) to prevent focus escape");

      const json = editor.getJSON() as { content?: Array<{ content?: Array<{ type?: string; content?: Array<{ type?: string }> }> }> };
      const firstLi = json.content?.[0]?.content?.[0];
      const nestedList = firstLi?.content?.find((n) => n.type === "bulletList");
      assert.strictEqual(nestedList, undefined, "Item 1 cannot sink into non-existent sibling");
    });

    test("TC-LIST-005: Multi-item selection starting from item 1 sinks items 2 and 3 into item 1", () => {
      editor.commands.setTextSelection({ from: 4, to: 24 });

      const handled = customSinkListItem(editor.state.schema.nodes.listItem)(
        editor.state,
        editor.view.dispatch,
      );
      assert.strictEqual(handled, true, "Multi-selection sink must succeed");

      const json = editor.getJSON() as { content?: Array<{ content?: Array<{ type?: string; content?: Array<{ type?: string; content?: unknown[] }> }> }> };
      const firstLi = json.content?.[0]?.content?.[0];
      assert.strictEqual(firstLi?.type, "listItem");
      const nestedList = firstLi?.content?.find((n) => n.type === "bulletList");
      assert.ok(nestedList, "Item 2 and 3 must be nested under Item 1");
      assert.strictEqual(nestedList?.content?.length, 2, "Nested list must contain 2 items (Item 2 & 3)");
    });

    test("TC-LIST-006: Shift-Tab lifts nested list item back to outer list", () => {
      editor.commands.setContent(`
        <ul>
          <li>
            <p>Parent Item</p>
            <ul>
              <li><p>Child Item</p></li>
            </ul>
          </li>
        </ul>
      `);

      editor.commands.setTextSelection(18); // inside Child Item
      const handled = customLiftListItem(editor.state.schema.nodes.listItem)(
        editor.state,
        editor.view.dispatch,
      );
      assert.strictEqual(handled, true, "Lift command must return true");

      const json = editor.getJSON() as { content?: Array<{ content?: unknown[] }> };
      const rootList = json.content?.[0];
      assert.strictEqual(rootList?.content?.length, 2, "Root list should have 2 sibling items after lift");
    });

    test("TC-LIST-007: Shift-Tab at root level consumes event to prevent focus loss", () => {
      editor.commands.setTextSelection(4); // inside top-level Item 1
      const handled = customLiftListItem(editor.state.schema.nodes.listItem)(
        editor.state,
        editor.view.dispatch,
      );
      assert.strictEqual(handled, true, "Must consume event to avoid focus loss");
    });

    test("TC-LIST-008: TaskList and TaskItem sink and lift support", () => {
      editor.commands.setContent(`
        <ul data-type="taskList">
          <li data-type="taskItem" data-checked="false"><p>Task 1</p></li>
          <li data-type="taskItem" data-checked="false"><p>Task 2</p></li>
        </ul>
      `);

      editor.commands.setTextSelection(14); // inside Task 2
      const taskItemType = getActiveListItemType(editor.state);
      assert.strictEqual(taskItemType?.name, "taskItem");

      const handled = customSinkListItem(taskItemType!)(
        editor.state,
        editor.view.dispatch,
      );
      assert.strictEqual(handled, true, "TaskItem sink must succeed");

      const json = editor.getJSON() as { content?: Array<{ content?: Array<{ type?: string; content?: Array<{ type?: string }> }> }> };
      const firstTask = json.content?.[0]?.content?.[0];
      const nestedTaskList = firstTask?.content?.find((n) => n.type === "taskList");
      assert.ok(nestedTaskList, "Task 2 must be nested under Task 1");
    });
  });
});
