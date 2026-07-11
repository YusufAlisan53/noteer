export interface Heading {
  level: number;
  text: string;
}

/**
 * Parses markdown text to extract heading levels and text.
 */
export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const regex = /^(#{1,6})\s+(.+)$/gm;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].trim()
    });
  }

  return headings;
}
