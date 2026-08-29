/** Extract CSP content attribute from HTML meta tag. */
export function getWebviewCspContent(html: string): string | undefined {
  const match = html.match(/http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/i)
    ?? html.match(/content="([^"]+)"[^>]*http-equiv="Content-Security-Policy"/i)
    ?? html.match(/content="(default-src[^"]*)"/);
  return match?.[1];
}
