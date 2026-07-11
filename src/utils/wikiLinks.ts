/**
 * src/utils/wikiLinks.ts
 *
 * Pre-processes Markdown text to convert [[Wiki Link]] syntax into a
 * format that react-markdown can render via a custom component.
 *
 * Strategy:
 *  We cannot use a remark plugin that introduces a custom AST node type
 *  because react-markdown v9 requires a separate rehype plugin chain to
 *  render custom nodes, which adds significant complexity.
 *
 *  Instead we use a lightweight preprocessor that converts:
 *    [[Note Name]]      →  [Note Name](wikilink://Note Name)
 *    [[Note Name|Alias]] →  [Alias](wikilink://Note Name)
 *
 *  This is a valid Markdown link with a custom `wikilink://` scheme.
 *  The `a` component override in Preview.tsx detects the scheme and
 *  renders a clickable span that calls `openOrCreateFile`.
 *
 *  The `wikilink://` URL is percent-encoded so special characters in
 *  note names (spaces, apostrophes, etc.) survive the Markdown parser.
 */

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Converts all [[Wiki Links]] in `markdown` to Markdown link syntax
 * with a `wikilink://` scheme, then returns the modified string.
 *
 * This is O(n) and allocation-minimal: uses a single `replaceAll` pass.
 *
 * @param markdown Raw Markdown source containing optional [[wiki-links]]
 * @returns Markdown with [[...]] converted to [label](wikilink://target)
 */
export function preprocessWikiLinks(markdown: string): string {
  return markdown.replace(WIKILINK_RE, (_match, target: string, alias?: string) => {
    const label       = (alias ?? target).trim();
    const encodedTarget = encodeURIComponent(target.trim());
    return `[${label}](wikilink://${encodedTarget})`;
  });
}

/** Returns true when an anchor href is a wiki-link URI. */
export function isWikiLink(href: string | undefined): href is string {
  return typeof href === 'string' && href.startsWith('wikilink://');
}

/**
 * Extracts the raw note name from a `wikilink://` URI.
 * Reverses the percent-encoding applied by `preprocessWikiLinks`.
 */
export function wikiLinkTarget(href: string): string {
  return decodeURIComponent(href.replace(/^wikilink:\/\//, ''));
}
