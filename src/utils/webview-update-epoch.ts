/**
 * Drop webview `update` messages that were queued before an HTML→GFM convert.
 * Convert bumps minEpoch; older updates would restore the pre-convert HTML table.
 */
export function shouldAcceptWebviewUpdate(
  messageEpoch: number | undefined,
  minEpoch: number,
): boolean {
  return (messageEpoch ?? 0) >= minEpoch;
}
