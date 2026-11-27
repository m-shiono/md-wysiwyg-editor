export const MAX_UNDO_HISTORY = 100;
export const DEFAULT_TYPING_IDLE_MS = 800;

export type UndoInputKind =
  | 'insertText'
  | 'deleteBackward'
  | 'deleteForward'
  | 'insertLineBreak'
  | 'compositionConfirm'
  | 'command';

export interface UndoInputEvent {
  kind: UndoInputKind;
  insertedText?: string;
  timestamp?: number;
  selectionReplaced?: boolean;
}

export function isWordBoundaryWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\u3000';
}

export function isPhrasePunctuationChar(ch: string): boolean {
  return /^[.,!?;:)\]}\u3001\u3002\uff0c\uff0e\uff01\uff1f\uff1b\uff1a\u300d\u300f\u3011\uff09]$/.test(
    ch,
  );
}

/**
 * Tracks editor input continuity and decides whether an edit merges into
 * the current `undoGroupId` or opens a new undo recording point.
 */
export class UndoGroupTracker {
  private readonly idleMs: number;
  private readonly prefix: string;
  private seq = 0;
  private currentGroupId: string | undefined;
  private lastKind: UndoInputKind | undefined;
  private lastTimestamp = 0;
  private afterWhitespace = false;
  private afterPunctuation = false;
  private boundaryPending = true;
  private cursorMovedExternally = false;

  constructor(options?: { idleMs?: number; prefix?: string }) {
    this.idleMs = options?.idleMs ?? DEFAULT_TYPING_IDLE_MS;
    this.prefix = options?.prefix ?? 'ug';
  }

  get activeGroupId(): string | undefined {
    return this.currentGroupId;
  }

  /** Record a non-typing cursor movement (arrows, click) that breaks typing continuity. */
  notifyCursorMove(): void {
    this.cursorMovedExternally = true;
  }

  /** Force the next edit to start a new undo group. */
  forceBoundary(): void {
    this.boundaryPending = true;
  }

  /** Reset tracker state (e.g. on undo/redo, mode switch, or external reload). */
  reset(): void {
    this.currentGroupId = undefined;
    this.lastKind = undefined;
    this.lastTimestamp = 0;
    this.afterWhitespace = false;
    this.afterPunctuation = false;
    this.boundaryPending = true;
    this.cursorMovedExternally = false;
  }

  /** Return an undoGroupId for the incoming input event. */
  nextGroupId(input: UndoInputEvent): string {
    const now = input.timestamp ?? Date.now();
    const text = input.insertedText ?? '';

    if (
      input.kind === 'compositionConfirm' ||
      input.kind === 'command' ||
      input.kind === 'insertLineBreak' ||
      input.selectionReplaced === true ||
      (input.kind === 'insertText' && text.length > 1)
    ) {
      const id = this.allocateNewGroup(input.kind, now);
      this.boundaryPending = true;
      this.afterWhitespace = false;
      this.afterPunctuation = false;
      return id;
    }

    if (input.kind === 'deleteBackward' || input.kind === 'deleteForward') {
      const canMerge =
        this.currentGroupId !== undefined &&
        !this.boundaryPending &&
        !this.cursorMovedExternally &&
        this.lastKind === input.kind &&
        now - this.lastTimestamp <= this.idleMs;

      if (canMerge) {
        this.lastTimestamp = now;
        return this.currentGroupId!;
      }

      const id = this.allocateNewGroup(input.kind, now);
      this.afterWhitespace = false;
      this.afterPunctuation = false;
      return id;
    }

    // insertText (single char or empty fallback)
    const isWhitespace = text.length === 1 && isWordBoundaryWhitespace(text);
    const isPunctuation = text.length === 1 && isPhrasePunctuationChar(text);

    const startsAfterWordBoundary =
      (this.afterWhitespace || this.afterPunctuation) && !isWhitespace;

    const canMerge =
      this.currentGroupId !== undefined &&
      !this.boundaryPending &&
      !this.cursorMovedExternally &&
      this.lastKind === 'insertText' &&
      now - this.lastTimestamp <= this.idleMs &&
      !startsAfterWordBoundary;

    const id = canMerge
      ? this.currentGroupId!
      : this.allocateNewGroup('insertText', now);

    if (canMerge) {
      this.lastTimestamp = now;
    }

    if (isWhitespace) {
      this.afterWhitespace = true;
      // Keep afterPunctuation until a non-whitespace character starts the next phrase.
    } else if (isPunctuation) {
      this.afterWhitespace = false;
      this.afterPunctuation = true;
    } else {
      this.afterWhitespace = false;
      this.afterPunctuation = false;
    }

    return id;
  }

  private allocateNewGroup(kind: UndoInputKind, timestamp: number): string {
    this.seq += 1;
    const id = `${this.prefix}-${this.seq}`;
    this.currentGroupId = id;
    this.lastKind = kind;
    this.lastTimestamp = timestamp;
    this.boundaryPending = false;
    this.cursorMovedExternally = false;
    return id;
  }
}
