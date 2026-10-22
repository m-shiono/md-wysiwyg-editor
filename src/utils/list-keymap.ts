import { Extension } from "@tiptap/core";
import type { NodeType, NodeRange } from "@tiptap/pm/model";
import { Fragment, Slice } from "@tiptap/pm/model";
import type { Command, EditorState, Transaction } from "@tiptap/pm/state";
import { ReplaceAroundStep } from "@tiptap/pm/transform";
import { liftListItem } from "@tiptap/pm/schema-list";

/**
 * クリップボードにテキスト（text/plain や text/html）が含まれているか判定する。
 * テキストが存在する場合は、画像ハンドラで横取りせず標準ペーストへ委譲すべき。
 */
export function shouldDelegateToTextPaste(clipboardData: {
  getData: (format: string) => string;
}): boolean {
  const plainText = clipboardData.getData("text/plain");
  const htmlText = clipboardData.getData("text/html");
  return Boolean((plainText && plainText.length > 0) || (htmlText && htmlText.length > 0));
}

/**
 * 現在のカーソル位置または選択範囲がリスト項目（listItem または taskItem）内にあるか判定し、
 * その NodeType を返す。テーブル内にある場合はテーブルのTab操作を優先するため null を返す。
 */
export function getActiveListItemType(state: EditorState): NodeType | null {
  const { $from } = state.selection;
  const { nodes } = state.schema;
  const tableType = nodes.table;
  const listItemType = nodes.listItem;
  const taskItemType = nodes.taskItem;

  // テーブル内ならテーブルキーマップに委譲
  if (tableType) {
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type === tableType) {
        return null;
      }
    }
  }

  // 祖先ノードからリスト項目タイプを探索
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (listItemType && node.type === listItemType) {
      return listItemType;
    }
    if (taskItemType && node.type === taskItemType) {
      return taskItemType;
    }
  }

  return null;
}

/**
 * リストアイテムのシンク（ネスト・ぶら下げ）を実行するヘルパー
 */
export function executeSink(
  range: NodeRange,
  itemType: NodeType,
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const { parent, startIndex } = range;
  const nodeBefore = parent.child(startIndex - 1);
  if (nodeBefore.type !== itemType) {
    return false;
  }

  if (dispatch) {
    const nestedBefore =
      nodeBefore.lastChild && nodeBefore.lastChild.type === parent.type;
    const inner = Fragment.from(nestedBefore ? itemType.create() : null);
    const slice = new Slice(
      Fragment.from(
        itemType.create(
          null,
          Fragment.from(parent.type.create(null, inner)),
        ),
      ),
      nestedBefore ? 3 : 1,
      0,
    );
    const before = range.start;
    const after = range.end;
    dispatch(
      state.tr
        .step(
          new ReplaceAroundStep(
            before - (nestedBefore ? 3 : 1),
            after,
            before,
            after,
            slice,
            1,
            true,
          ),
        )
        .scrollIntoView(),
    );
  }
  return true;
}

/**
 * 先頭行を含む複数行選択時でも、2行目以降を安全にインデントできるスマートな sinkListItem コマンド。
 * 先頭行単独の場合はフォーカス抜けを防ぐためにイベントを消費（return true）する。
 */
export function customSinkListItem(itemType: NodeType): Command {
  return function (state, dispatch) {
    const { $from, $to } = state.selection;
    const range = $from.blockRange(
      $to,
      (node) => node.childCount > 0 && node.firstChild!.type === itemType,
    );

    if (!range) {
      return false;
    }

    const { parent, startIndex, endIndex } = range;

    // ケース1: 先頭行のみ選択されている場合
    // 先頭行には親となる兄弟アイテムがないためインデント不可だが、
    // Webview外へのフォーカス離脱を防ぐためイベントを消費する
    if (startIndex === 0 && endIndex === 1) {
      return true;
    }

    // ケース2: 複数行選択で先頭行（startIndex === 0）が含まれる場合
    // 先頭行はネストできないが、2行目以降（startIndex 1〜endIndex）は先頭行の下にネスト可能
    if (startIndex === 0 && endIndex > 1) {
      const firstChild = parent.child(0);
      const subStartPos = range.start + firstChild.nodeSize;
      const subEndPos = range.end;
      if (subStartPos < subEndPos) {
        const $subFrom = state.doc.resolve(subStartPos + 1);
        const $subTo = state.doc.resolve(subEndPos - 1);
        const subRange = $subFrom.blockRange(
          $subTo,
          (node) => node.childCount > 0 && node.firstChild!.type === itemType,
        );
        if (subRange && subRange.startIndex > 0) {
          return executeSink(subRange, itemType, state, dispatch);
        }
      }
      return true;
    }

    // ケース3: 通常のシンク（startIndex > 0）
    if (startIndex > 0) {
      const nodeBefore = parent.child(startIndex - 1);
      if (nodeBefore.type === itemType) {
        return executeSink(range, itemType, state, dispatch);
      }
    }

    return true;
  };
}

/**
 * リストアイテムのアウトデント（引き上げ）を行うスマートな liftListItem コマンド。
 * 最上位階層でこれ以上戻せない場合でも、フォーカス抜けを防ぐためにイベントを消費する。
 */
export function customLiftListItem(itemType: NodeType): Command {
  return function (state, dispatch) {
    const { $from, $to } = state.selection;
    const range = $from.blockRange(
      $to,
      (node) => node.childCount > 0 && node.firstChild!.type === itemType,
    );

    if (!range) {
      return false;
    }

    if (liftListItem(itemType)(state, dispatch)) {
      return true;
    }

    // これ以上アウトデントできない場合でもフォーカス抜けを防止
    return true;
  };
}

export const ListKeymap = Extension.create({
  name: "enhancedListKeymap",
  priority: 150,

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const itemType = getActiveListItemType(this.editor.state);
        if (!itemType) {
          return false;
        }
        return customSinkListItem(itemType)(
          this.editor.state,
          this.editor.view.dispatch,
        );
      },
      "Shift-Tab": () => {
        const itemType = getActiveListItemType(this.editor.state);
        if (!itemType) {
          return false;
        }
        return customLiftListItem(itemType)(
          this.editor.state,
          this.editor.view.dispatch,
        );
      },
    };
  },
});
