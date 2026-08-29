const IMAGE_FILENAME_PATTERN = /^image-(\d{4})\.[a-z0-9]+$/i;

/** Compute next image sequence from existing filenames in img/ directory. */
export function getNextImageSequence(filenames: string[]): number {
  let max = 0;
  for (const name of filenames) {
    const base = name.split('/').pop() ?? name;
    const match = IMAGE_FILENAME_PATTERN.exec(base);
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }
  return Math.min(max + 1, 9999);
}

/** Format image filename with zero-padded 4-digit sequence. */
export function formatImageFilename(sequence: number, extension: string): string {
  const seq = Math.max(1, Math.min(sequence, 9999));
  const ext = extension.replace(/^\./, '').toLowerCase();
  return `image-${String(seq).padStart(4, '0')}.${ext}`;
}

/** Map MIME type to file extension. */
export function mimeToExtension(mime: string): string | undefined {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };
  return map[mime.toLowerCase()];
}

/** Validate image path stays within workspace img/ directory. */
export function isSafeImagePath(_mdUri: string, imageRelativePath: string): boolean {
  if (imageRelativePath.includes('..')) {
    return false;
  }
  if (!imageRelativePath.startsWith('img/')) {
    return false;
  }
  return !/[\\]/.test(imageRelativePath);
}
