import { getNextImageSequence, formatImageFilename, mimeToExtension } from './image-numbering';

export type Align = 'left' | 'center' | 'right' | null;
export type Mode = 'visual' | 'source' | 'preview';

/**
 * Apply size preset:
 * 25% -> '25%'
 * 50% -> '50%'
 * 75% -> '75%'
 * 100% -> null (Reset)
 */
export function applyImageSizePreset(preset: string): string | null {
  if (preset === '100%' || preset === '100% (Reset)') {
    return null;
  }
  return preset;
}

/**
 * Normalize image drag width clamped to [32, parentWidth] as an integer px string.
 */
export function normalizeImageDragWidth(px: number, parentWidth: number): string {
  const rounded = Math.round(px);
  const minClamped = Math.max(32, rounded);
  const maxClamped = Math.min(Math.round(parentWidth), minClamped);
  return String(maxClamped);
}

/**
 * Toggle image alignment:
 * null -> clicked
 * clicked === cur -> null
 * different -> clicked
 */
export function toggleImageAlign(cur: Align, clicked: Exclude<Align, null>): Align {
  if (cur === clicked) {
    return null;
  }
  return clicked;
}

/**
 * Update alt attribute without mutating the input object.
 */
export function updateImageAlt<T extends Record<string, unknown>>(attrs: T, alt: string): T {
  return {
    ...attrs,
    alt,
  };
}

export interface DroppedFileItem {
  name: string;
  type: string;
}

export interface PlannedImageFile {
  filename: string;
}

/**
 * Filter image files (by mime or extension) and assign sequential filenames image-NNNN.ext.
 */
export function planDroppedImageFiles(
  files: DroppedFileItem[],
  existing: string[],
): PlannedImageFile[] {
  const imageFiles: { file: DroppedFileItem; ext: string }[] = [];

  for (const f of files) {
    let ext = mimeToExtension(f.type);
    if (!ext) {
      const match = /\.(png|jpe?g|gif|svg|webp)$/i.exec(f.name);
      if (match) {
        ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
      }
    }
    if (ext) {
      imageFiles.push({ file: f, ext });
    }
  }

  let nextSeq = getNextImageSequence(existing);
  const result: PlannedImageFile[] = [];

  for (const item of imageFiles) {
    result.push({
      filename: formatImageFilename(nextSeq, item.ext),
    });
    nextSeq += 1;
  }

  return result;
}

/**
 * Determine if dropped images can be inserted.
 * Rejects untitled, readonly, or preview mode.
 */
export function canInsertDroppedImage(ctx: {
  mode: Mode;
  readonly: boolean;
  untitled: boolean;
}): { ok: boolean; reason?: string } {
  if (ctx.untitled) {
    return { ok: false, reason: 'Save document first' };
  }
  if (ctx.readonly) {
    return { ok: false, reason: 'Readonly mode' };
  }
  if (ctx.mode === 'preview') {
    return { ok: false, reason: 'Preview mode' };
  }
  return { ok: true };
}

/**
 * Check if drag event contains files (rather than internal text drag).
 */
export function isImageFileDrag(types: string[]): boolean {
  return types.some((t) => t.toLowerCase() === 'files');
}

/**
 * Lightbox open conditions by mode and trigger.
 * Preview: click -> open
 * Visual: click -> select (do not open), dblclick / zoom -> open
 * Readonly: click / dblclick / zoom -> open
 */
export function shouldOpenLightbox(ctx: {
  mode: Mode;
  readonly: boolean;
  trigger: 'click' | 'dblclick' | 'zoom';
}): boolean {
  if (ctx.trigger === 'zoom' || ctx.trigger === 'dblclick') {
    return true;
  }
  if (ctx.trigger === 'click') {
    return ctx.mode === 'preview' || ctx.readonly;
  }
  return false;
}

/**
 * Lightbox close conditions:
 * Escape key or backdrop click -> close
 * Image click -> do not close
 */
export function shouldCloseLightbox(ev: {
  key?: string;
  target: 'backdrop' | 'image' | 'none';
}): boolean {
  if (ev.key === 'Escape') {
    return true;
  }
  if (ev.target === 'backdrop') {
    return true;
  }
  return false;
}
